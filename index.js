const { wrapAndRun, getAppInfo, monitoringFn } = require("cli-primer");
const { execute } = require("./own-modules/main");
const { cleanup } = require("./own-modules/utils");

// Setup our application via the `cli-primer` wrapper.
// See `https://github.com/ciacob/cli-primer` for details.
const { name, version } = getAppInfo(monitoringFn);
(async function () {
  const exitValue = await wrapAndRun(
    {
      showDebugMessages: false,
      useOutputDir: false,
      useSessionControl: false,
      useConfig: true,
      useHelp: true,
      argsDictionary: [
        {
          name: "Show Debug Messages",
          payload: "--debug",
          doc: "Turns on displaying verbose information such as the MIDI number for NOTE ON and NOTE OFF messages, and other internal application notices.",
        },
        {
          name: "Virtual Output Port Name",
          payload: /^--(virtualOutputName|vo)=(.+)/,
          doc: "The name of a virtual MIDI (output) port to send transformed MIDI messages to.",
          mandatory: true,
        },
        {
          name: "Split Table",
          payload: /^--(splitTable|st)=(.+)/,
          doc: 'Optional. Split definitions in JSON format to selectively send MIDI notes to specific channels.\nExample: [{"type":"range","midiFrom":60,"midiTo":63,"channel":3},{"type":"enumeration","midi":[64,65,66],"channel":4}].\nMIDI notes not explicitly routed to a channel will be sent to their original channel. It is advised to define the split table via the configuration file rather than via the command line.',
        },

        {
          name: "Input Exclusions List",
          payload: /^--(exclusionsList|el)=(.+)/,
          doc: `A JSON list of (input) MIDI port names ${name}${
            version ? " " + version : ""
          } should not be listening to. Values in that list can use the "?" and "*" wildcards to match one char or any chars respectively.\nExample : ["MPK Mini Mk3 MIDI*", "KeyLab Essential ?? MIDI In", "Oxygen Pro 49 MIDI In"]. You may want to filter out some of your existing MIDI gear in order to let them be available to other applications. Note that the input whose name matches your virtual port, if any, is always excluded in order to prevent MIDI feed-back. It is advised to define the split table via the configuration file rather than via the command line.`,
        },
      ],
    },
    execute,
    cleanup
  );
  if ([0, 1, 2].includes(exitValue)) {
    process.exit(exitValue);
  }
})();
