const {
  makeClosure,
  buildSplitTable,
  transformMidiSrc,
  setupMidiInput,
  setMidiTransformer,
  setInputs,
  setOutput,
} = require("./utils");
const midi = require("midi");

/**
 * Main entry point in application's logic. It is called by cli-primer's logic
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
function execute(inputData, utils, monitoringFn) {
  const $m = monitoringFn || function () {};
  let vOutPortIndex = null;
  const vOutPortName = inputData.virtualOutputName;
  const splitDefinitions = inputData.splitTable || [];
  const inputPortsExclusions = inputData.exclusionsList || [];

  // Honor the `--debug` flag if given.
  if (inputData.debug) {
    utils.setDebugMode(true);
  }

  // Build a function to transform incoming MIDI messages.
  const splitTable = buildSplitTable(splitDefinitions);
  setMidiTransformer(makeClosure(transformMidiSrc, splitTable));

  // List all available MIDI output ports and locate the virtual output port.
  const output = new midi.Output();
  const outPortCount = output.getPortCount();
  $m({
    type: "debug",
    message: `Found ${outPortCount} MIDI Output devices.`,
  });
  $m({
    type: "debug",
    message: `Searching for virtual output port ${vOutPortName}...`,
  });
  for (let i = 0; i < output.getPortCount(); i++) {
    const outPortName = output.getPortName(i);
    if (outPortName == vOutPortName) {
      vOutPortIndex = i;
    }
    $m({
      type: "debug",
      message: `${vOutPortIndex === i ? "--> " : ""}${outPortName} (port ${i})`,
    });
  }

  // Connect to the virtual output or error out if not found.
  if (vOutPortIndex !== null) {
    output.openPort(vOutPortIndex);
    setOutput(output);
    $m({
      type: "info",
      message: `Connected to virtual MIDI output: ${vOutPortName}`,
    });
  } else {
    $m({
      type: "error",
      message: `Fatal. Virtual MIDI output port "${vOutPortName}" not found.`,
    });
    process.exit(2);
  }

  // List all available MIDI input ports; attempt to open and listen to each one
  // that is not on the exclusions list.
  const tempInput = new midi.Input();
  const inPortCount = tempInput.getPortCount();
  $m({
    type: "debug",
    message: `Found ${inPortCount} MIDI Input devices.`,
  });
  const inputInstances = [];
  for (let i = 0; i < inPortCount; i++) {
    const inputInstance = setupMidiInput(
      i,
      output,
      vOutPortName,
      ...inputPortsExclusions
    );
    if (inputInstance) {
      $m({
        type: "info",
        message: `Listening to MIDI input port ${inputInstance.getPortName(
          i
        )}...`,
      });
      inputInstances.push(inputInstance);
    } else {
      $m({
        type: "debug",
        message: `Skipped MIDI input port @${i}.`,
      });
    }
  }
  if (!inputInstances.length) {
    $m({
      type: "warn",
      message: `Not listening to any MIDI input devices. You may want to check your settings. Exiting.`,
    });
    return 1;
  }
  setInputs(inputInstances);

  // Returning something else than 0, 1 or 2 is needed in order to keep the process running.
  return 3;
}

module.exports = {
  execute,
};
