// Common JS application;

// Imports
const { monitoringFn } = require("cli-primer");
const midi = require("midi");
const $m = monitoringFn || function () {};
let transformMidi = function () {};
let inputInstances = [];

function setMidiTransformer(fnTransformer) {
  transformMidi = fnTransformer;
}

function setInputs(inputsList) {
  inputInstances = inputsList;
}

// Flag to raise when the `cleanup` function has been called, used to protect
// already executing shutdown logic.
let cleanupCalled = false;

/**
 * Creates a closure that wraps the given source function with the provided context arguments.
 *
 * @function makeClosure
 * @param {Function} source - The source function to wrap.
 * @param {...*} context - The context arguments to pre-apply to the source function.
 * @returns {Function} A closure that, when invoked, calls the source function with the context arguments followed by any additional arguments provided to the closure.
 *
 * @example
 * function add(a, b, c) {
 *   return a + b + c;
 * }
 *
 * const addWith5And10 = makeClosure(add, 5, 10);
 * console.log(addWith5And10(3)); // Output: 18
 */
function makeClosure(source, ...context) {
  // Return a new function (closure) that packages source with the context arguments
  return function (...args) {
    // Invoke the source function with context arguments followed by any new arguments
    return source(...context, ...args);
  };
}

/**
 * Builds a split table for MIDI messages based on provided split definitions.
 *
 * @function buildSplitTable
 * @param {Array<Object>} splitDefinitions - An array of split definitions that determine how MIDI messages should be split.
 * @param {('range'|'enumeration')} splitDefinitions[].type - The type of split definition, either 'range' or 'enumeration'.
 * @param {number} [splitDefinitions[].midiFrom] - The starting MIDI note value for 'range' type definitions (inclusive).
 * @param {number} [splitDefinitions[].midiTo] - The ending MIDI note value for 'range' type definitions (inclusive).
 * @param {Array<number>} [splitDefinitions[].midi] - An array of MIDI note values for 'enumeration' type definitions.
 * @param {number} splitDefinitions[].channel - The MIDI channel to which the notes should be mapped (1-16).
 * @returns {Object} objSplitTable - An object mapping MIDI note values to channels based on the split definitions.
 * @throws {TypeError} If splitDefinitions is not an array.
 *
 * @example
 * const splitDefinitions = [
 *   { type: 'range', midiFrom: 60, midiTo: 63, channel: 3 },
 *   { type: 'enumeration', midi: [64, 65, 66], channel: 4 },
 *   { type: 'range', midiFrom: 61, midiTo: 62, channel: 2 }, // Overrides previous range for 61 and 62
 * ];
 *
 * const splitTable = buildSplitTable(splitDefinitions);
 * console.log(splitTable);
 * // Output:
 * // { '60': 3, '61': 2, '62': 2, '63': 3, '64': 4, '65': 4, '66': 4 }
 */
function buildSplitTable(splitDefinitions) {
  // Initialize the split table as an empty object
  const splitTable = {};

  // Check if splitDefinitions is an array
  if (!Array.isArray(splitDefinitions) || !splitDefinitions.length) {
    $m({
      type: "warn",
      message:
        'Invalid "splitDefinitions" provided, it should be an Array. No MIDI notes will be rerouted.',
    });
    return splitTable; // Return empty split table
  }

  // Iterate over each split definition in the array
  splitDefinitions.forEach((definition, index) => {
    if (definition.type === "range") {
      // Validate range type definitions
      const { midiFrom, midiTo, channel } = definition;
      if (
        typeof midiFrom === "number" &&
        midiFrom >= 0 &&
        midiFrom <= 127 &&
        typeof midiTo === "number" &&
        midiTo >= 0 &&
        midiTo <= 127 &&
        typeof channel === "number" &&
        channel >= 1 &&
        channel <= 16 &&
        midiFrom <= midiTo
      ) {
        for (let midi = midiFrom; midi <= midiTo; midi++) {
          splitTable[midi] = channel;
        }
      } else {
        $m({
          type: "warn",
          message: `Skipping split definition @${index} because it contains an invalid MIDI range.`,
          data: definition,
        });
      }
    } else if (definition.type === "enumeration") {
      // Validate enumeration type definitions
      const { midi, channel } = definition;
      if (
        Array.isArray(midi) &&
        midi.every(
          (midiValue) =>
            typeof midiValue === "number" && midiValue >= 0 && midiValue <= 127
        ) &&
        typeof channel === "number" &&
        channel >= 1 &&
        channel <= 16
      ) {
        midi.forEach((midiValue) => {
          splitTable[midiValue] = channel;
        });
      } else {
        $m({
          type: "warn",
          message: `Skipping split definition @${index} because it contains invalid MIDI values.`,
          data: definition,
        });
      }
    } else {
      $m({
        type: "warn",
        message: `Skipping split definition @${index} because it has an unknown type (${definition.type}).`,
        data: definition,
      });
    }
  });

  // Return the constructed split table object
  return splitTable;
}

/**
 * Transforms a MIDI message based on a given split table.
 *
 * @function transformMidiSrc
 * @param {Object} splitTable - An object mapping MIDI note values to channels.
 * @param {Number} deltaTime - The time elapsed since the last MIDI event.
 * @param {Array} message - The original MIDI message array [status, note, velocity].
 * @returns {Array} The transformed MIDI message or the original message if no transformation is applied.
 *
 * @example
 * const splitTable = { '60': 3, '61': 2 };
 * const message = [144, 60, 127]; // Note On for MIDI note 60
 * const newMessage = transformMidiSrc(splitTable, 0, message);
 * console.log(newMessage); // Output: [146, 60, 127] if mustSplitByChannel is true
 */
function transformMidiSrc(splitTable, deltaTime, message) {
  // Destructure the original MIDI message
  const [status, note, velocity] = message;

  // Determine the type of MIDI message
  const isGenuineNoteOff = status >= 128 && status <= 143;
  const isNoteOn = status >= 144 && status <= 159;
  const isFakeNoteOff = isNoteOn && velocity === 0;
  const mustSplitByChannel = isNoteOn || isFakeNoteOff || isGenuineNoteOff;

  $m({
    type: "debug",
    message: `${
      isNoteOn
        ? "NOTE ON"
        : isGenuineNoteOff || isFakeNoteOff
        ? "NOTE OFF"
        : "VALUE"
    }: ${note}`,
  });

  // Check if the message should be transformed
  if (mustSplitByChannel && splitTable && splitTable.hasOwnProperty(note)) {
    const channel = splitTable[note];
    $m({
      type: "debug",
      message: `REROUTED TO CHANNEL: ${channel - 1}`,
    });
    const newStatus = (status & 0xf0) | (channel - 1);
    return [newStatus, note, velocity];
  }

  // Pass-through the original message if no transformation is applied
  return message;
}

/**
 * Function to be used for handling incoming MIDI messages. Called for every
 * incoming MIDI message on any of the MIDI Input ports being listened to.
 *
 * @param   {MIDIInput} input
 *          MIDI port the incoming MIDI message originated from.
 *
 * @param   {MIDIOutput} output
 *          MIDI port to forward incoming MIDI message to.
 *
 * @param   {Number} portIndex
 *          Zero-based index of the `input` port, in the order the host
 *          OS lists it among the available MIDI ports.
 *
 * @param   {Number} deltaTime
 *          TBD
 *
 * @param   {Array} message
 *          Array with information about the current MIDI message.
 *
 */
function handleMessage(input, output, portIndex, deltaTime, message) {
  output.sendMessage(transformMidi(deltaTime, message));
}

/**
 * Converts a wildcard pattern to a regular expression.
 * Supports "?" for any single character and "*" for any sequence of characters.
 *
 * @param   {String} pattern
 *          The wildcard pattern string.
 * @returns {RegExp}
 *          The regular expression equivalent of the pattern.
 */
function wildcardToRegex(pattern) {
  // Escape special regex characters except for "?" and "*", then replace "?" and "*".
  const escapedPattern = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&") // Escape special characters
    .replace(/\?/g, ".") // Replace "?" with "."
    .replace(/\*/g, ".*"); // Replace "*" with ".*"

  return new RegExp(`^${escapedPattern}$`); // Match the entire string
}

/**
 * Function to check if a port name matches any of the exclusion patterns.
 *
 * @param   {String} portName
 *          The name of the MIDI port to check.
 * @param   {String[]} exclusions
 *          List of exclusion patterns to check against.
 * @returns {Boolean}
 *          True if the port name matches any exclusion pattern, otherwise false.
 */
function isExcluded(portName, exclusions) {
  return exclusions.some((pattern) => wildcardToRegex(pattern).test(portName));
}

/**
 * Function to open and set up a MIDI input port, while rerouting its output
 * and selectively transforming its incoming messages.
 *
 * @param   {Number} portIndex
 *          Index of a MIDI Input device to open and set up.
 * @param   {MIDIOutput} output
 *          Output MIDI device to route all incoming signals to.
 * @param   {String[]} exclusions
 *          Port names or patterns to skip listening to.
 * @returns {midi.Input|null}
 *          Returns the input instance if set up, otherwise null.
 */
function setupMidiInput(portIndex, output, ...exclusions) {
  // Open the specified input port
  const input = new midi.Input();
  const portName = input.getPortName(portIndex);

  // Check if the port name matches any exclusion patterns
  if (isExcluded(portName, exclusions)) {
    return null;
  }

  // Try to open port
  input.openPort(portIndex);

  // Observe Input MIDI messages coming through the port
  input.on("message", (deltaTime, message) => {
    handleMessage(input, output, portIndex, deltaTime, message);
  });

  // Return the input instance to keep it alive
  return input;
}

/**
 * Function to ensure no ports remain open after the application exits.
 * This lowers the chances of them not being available to other
 * applications after this one gets closed. It is called by cli-primer's logic
 * and injected with user-provided input, a number of utilities functions,
 * and a general purpose monitoring function. See `https://github.com/ciacob/cli-primer`
 * for details.
 *
 * @param {Object} inputData
 *        Merged dataset CLI-primer has built out of this application's configuration
 *        file and provided command-line arguments.
 *
 * @param {Object} utils
 *        Merged set of utility functions CLI-primer provides, across all of its modules.
 *
 * @param {Function} monitoringFn
 *        General-purpose monitoring function. Takes an Object with keys: `type`, `message`
 *        and `data`, and prints messages and dumps data to the console in a consistent
 *        format.
 */
function cleanup(inputData, utils, monitoringFn) {
  // Prevent running multiple times.
  if (cleanupCalled) return;
  cleanupCalled = true;
  $m({
    type: "info",
    message: "Application exiting. Closing ports...",
  });

  inputInstances.forEach((input) => input.closePort());
  output.closePort();
  $m({
    type: "debug",
    message: "Closed everything.",
  });

  // Ensure the process exits.
  process.exit();
}

module.exports = {
  makeClosure,
  buildSplitTable,
  transformMidiSrc,
  setupMidiInput,
  cleanup,
  setMidiTransformer,
  setInputs,
};
