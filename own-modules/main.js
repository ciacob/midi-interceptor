const {
  makeClosure,
  buildSplitTable,
  transformMidiSrc,
  setupMidiInput,
  setMidiTransformer,
  setInputs,
} = require("./utils");

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

  //   [
  //     { type: "range", midiFrom: 74, midiTo: 88, channel: 1 }, // sopranos
  //     { type: "range", midiFrom: 63, midiTo: 73, channel: 2 }, // altos
  //     { type: "range", midiFrom: 55, midiTo: 62, channel: 3 }, // tenors
  //     { type: "range", midiFrom: 35, midiTo: 54, channel: 4 }, // basses
  //   ];

  // Build a function to transform incoming MIDI messages.
  setMidiTransformer(
    makeClosure(transformMidiSrc, buildSplitTable(splitDefinitions))
  );

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
        message: `Listening to MIDI input port ${inputInstance.getPortName}...`,
      });
      inputInstances.push(inputInstance);
    } else {
      $m({
        type: "debug",
        message: `Skipped MIDI input port ${inputInstance.getPortName}.`,
      });
    }
  }
  setInputs(inputInstances);
}
