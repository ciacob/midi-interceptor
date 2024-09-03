"// Common JS application";
const midi = require("midi");

// HELPERS
// -------

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
    console.error("Error: splitDefinitions should be an array.");
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
        console.warn(
          `Warning: Invalid range definition at index ${index} was discarded.`
        );
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
        console.warn(
          `Warning: Invalid enumeration definition at index ${index} was discarded.`
        );
      }
    } else {
      console.warn(
        `Warning: Invalid type '${definition.type}' at index ${index} was discarded.`
      );
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

  console.log (`NOTE is: ${note}`)

  // Determine the type of MIDI message
  const isGenuineNoteOff = status >= 128 && status <= 143;
  const isNoteOn = status >= 144 && status <= 159;
  const isFakeNoteOff = isNoteOn && velocity === 0;
  const mustSplitByChannel = isNoteOn || isFakeNoteOff || isGenuineNoteOff;

  // Check if the message should be transformed
  if (mustSplitByChannel && splitTable && splitTable.hasOwnProperty(note)) {
    const channel = splitTable[note];

    console.log (`REROUTED TO CHANNEL: ${channel - 1}`);

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
  // const [status, note, velocity] = message;
  // const deviceName = input.getPortName(portIndex);
  // const isNoteOn = status >= 144 && status <= 159;

  // // Note: a "Note On" with velocity 0 is to be treated as a "Note Off"
  // const isNoteOff = isNoteOn && velocity === 0;
  // if (isNoteOn && !isNoteOff) {
  //   // Regular "Note On" messages
  //   console.log(
  //     `Note On: ${note} with velocity ${velocity} on device ${deviceName} @port ${portIndex}`
  //   );
  // } else if (isNoteOff || (status >= 128 && status <= 143)) {
  //   // "Note Off" messages
  //   console.log(`Note Off: ${note} on device ${deviceName} @port ${portIndex}`);
  // } else {
  //   console.log(
  //     `Other MIDI message received on device ${deviceName} @port ${portIndex}`
  //   );
  // }

  // Transform and then forward the message to the virtual MIDI output
  output.sendMessage(transformMidi(deltaTime, message));
}

/**
 * Function to open and set up a MIDI input port, while rerouting its output
 * and selectively transforming its incoming messages.
 * @param   {Number} portIndex
 *          Index of a MIDI Input device to open and set up.
 * @param   {MIDIOutput} output
 *          Output MIDI device to route all incoming signals to.
 * @param   {String[]} exclusions
 *          Port names to skip listening to.
 * @returns
 */
function setupMidiInput(portIndex, output, ...exclusions) {
  // Open the specified input port
  const input = new midi.Input();
  const portName = input.getPortName(portIndex);
  if (exclusions.includes(portName)) {
    return null;
  }
  console.log(`Opening MIDI input "${portName}" (port ${portIndex})...`);
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
 * applications after this one gets closed.
 */
function cleanup() {
  // Prevent running multiple times.
  if (cleanupCalled) return;
  cleanupCalled = true;

  console.log("\nApplication exiting. Closing ports...");
  inputInstances.forEach((input) => input.closePort());
  output.closePort();
  console.log("Closed everything.");

  // Ensure the process exits.
  process.exit();
}

// MAIN
// ----
let cleanupCalled = false;
let vOutPortIndex = null;
const vOutPortName = "MIDI Interceptor Output";

const splitDefinitions = [
  { type: "range", midiFrom: 74, midiTo: 88, channel: 1 }, // sopranos
  { type: "range", midiFrom: 63, midiTo: 73, channel: 2 }, // altos
  { type: "range", midiFrom: 55, midiTo: 62, channel: 3 }, // tenors
  { type: "range", midiFrom: 35, midiTo: 54, channel: 4 }, // basses
];

// Create the transformMidi function using makeClosure
const transformMidi = makeClosure(
  transformMidiSrc,
  buildSplitTable(splitDefinitions)
);

// Handle the various ways of terminating this application.
process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  cleanup();
});
process.on("exit", (code) => {
  console.log(`Process exiting with code: ${code}`);
  cleanup();
});

// List all available MIDI output ports and locate the virtual MIDI output
// port "MIDI Interceptor Output" created inside `loopMidi`.
const output = new midi.Output();
const outPortCount = output.getPortCount();
console.log(`\nFound ${outPortCount} MIDI Output devices.`);
console.log(`Searching for virtual output port ${vOutPortName}...`);
for (let i = 0; i < output.getPortCount(); i++) {
  const outPortName = output.getPortName(i);
  if (outPortName == vOutPortName) {
    vOutPortIndex = i;
  }
  console.log(`${vOutPortIndex === i ? "--> " : ""}${outPortName} (port ${i})`);
}

// Connect to the virtual output
if (vOutPortIndex !== null) {
  output.openPort(vOutPortIndex);
  console.log(`\nConnected to virtual MIDI output: ${vOutPortName}`);
} else {
  console.error(`\nVirtual MIDI output port "${vOutPortName}" not found.`);
  process.exit(1);
}

// Instantiate a single midi.Input instance to get port count.
const tempInput = new midi.Input();
const inPortCount = tempInput.getPortCount();
console.log(`\nFound ${inPortCount} MIDI Input devices.`);

// List all available MIDI input ports; open and listen to each one.
const inputInstances = [];
for (let i = 0; i < inPortCount; i++) {
  const inputInstance = setupMidiInput(i, output, vOutPortName);
  if (inputInstance) {
    inputInstances.push(inputInstance);
  }
}
console.log("Listening to all available MIDI input ports...");
