"// Common JS application";
const midi = require("midi");

// HELPERS
// -------
function transformMidi(deltaTime, message) {
  // Example logic: split `note on` and `note off` among first
  // four channels, based on their pitch.
  const [status, note, velocity] = message;
  const isGenuineNoteOff = status >= 128 && status <= 143;
  const isNoteOn = status >= 144 && status <= 159;
  const isFakeNoteOff = isNoteOn && velocity === 0;
  const mustSplitByChannel = isNoteOn || isFakeNoteOff || isGenuineNoteOff;
  if (mustSplitByChannel) {
    let channel = 1;
    if (note >= 60) {
      channel = 1;
    } else if (note >= 48) {
      channel = 2;
    } else if (note >= 36) {
      channel = 3;
    } else {
      channel = 4;
    }
    const newStatus = (status & 0xf0) | (channel - 1);
    return [newStatus, note, velocity];
  }

  // Pass-through anything else
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
  const [status, note, velocity] = message;
  const deviceName = input.getPortName(portIndex);
  const isNoteOn = status >= 144 && status <= 159;

  // Note: a "Note On" with velocity 0 is to be treated as a "Note Off"
  const isNoteOff = isNoteOn && velocity === 0;
  if (isNoteOn && !isNoteOff) {
    // Regular "Note On" messages
    console.log(
      `Note On: ${note} with velocity ${velocity} on device ${deviceName} @port ${portIndex}`
    );
  } else if (isNoteOff || (status >= 128 && status <= 143)) {
    // "Note Off" messages
    console.log(`Note Off: ${note} on device ${deviceName} @port ${portIndex}`);
  } else {
    console.log(
      `Other MIDI message received on device ${deviceName} @port ${portIndex}`
    );
  }

  // Forward the message to the virtual MIDI output
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


// Handle the various ways of terminating this application.
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    cleanup();
});
process.on('exit', (code) => {
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
