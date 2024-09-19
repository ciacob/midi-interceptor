# midi-interceptor
### A small _Node.js_ application that listens to available MIDI input devices, processes incoming messages, and sends them to a virtual MIDI output, which can be used by your DAW as a MIDI input source.

The application merges MIDI inputs and offers flexible control over how incoming MIDI __Note On__ and __Note Off__ messages are routed and split across MIDI channels.

You can define _split definitions_ for routing either _individual notes_ or _note ranges_ to specific MIDI channels (currently supports channels 1-16). This can be leveraged within your DAW or sequencer, for example, to record specific notes to specific tracks or assign virtual instruments to specific zones of your keyboard.

This project is designed as a command-line tool and is powered by [cli-primer](https://www.npmjs.com/package/cli-primer), making it highly configurable through CLI arguments and/or a configuration file.

## Typical scenarios
* You have __several MIDI controllers__ but your DAW/notation editor only supports __one input controller__ at a time.
* You want to input/record __distinct musical elements__ from your MIDI keyboard (e.g., simultaneously record a bassline and a melody on two different tracks), but your MIDI keyboard does not have built-in __split functionality__.

## Installation
Ensure you have the latest LTS version of _Node.js_ installed. If not, check their [official releases](https://nodejs.org/en) page.
1.	Use `npm` to globally install `midi-interceptor`:
```bash
npm install -g midi-interceptor
```
2.	Ensure you have a __virtual MIDI port__. This is needed to collect the MIDI messages `midi-interceptor` rewrites, and to send them to your DAW, sequencer, or notation editor.

    To set up a virtual MIDI port:

    * __Windows__: Install [loopMIDI](https://www.tobias-erichsen.de/software/loopmidi.html), a free tool for creating virtual MIDI ports. Once installed, open it, add a virtual MIDI port (e.g., name it "MIDI Interceptor Output"), and note the name you gave it.

    * __macOS__: Use the built-in _IAC Driver_:
      1. Open __Audio MIDI Setup__.
      2. Go to __Window > Show MIDI Studio__.
      3. Double-click __IAC Driver__ and check __Device is online__.
      4. Create a new port (e.g., name it "MIDI Interceptor Output") and note the name you gave it.

    * __Linux__: Depending on your distribution, there may be a built-in virtual MIDI port, or you may need to install and configure an additional package. Consult your distribution's documentation for details.

## Configuration
To initialize a configuration file:
```bash
midi-interceptor --ic
```

This creates the file `midi-interceptor.config` in your home directory. Open it in a JSON editor.
The file allows you to define multiple _profiles_, which you can switch between at runtime, via the `--cp=<profile_name>` argument.

Here is a sample configuration:
```json

{
  "profiles": [
    {
      "name": "satb_choir",
      "settings": {
        "virtualOutputName": "MIDI Interceptor Output",
        "splitTable": [
          { "type": "range", "midiFrom": 74, "midiTo": 88, "channel": 1 },
          { "type": "range", "midiFrom": 63, "midiTo": 73, "channel": 2 },
          { "type": "range", "midiFrom": 55, "midiTo": 62, "channel": 3 },
          { "type": "range", "midiFrom": 35, "midiTo": 54, "channel": 4 }
        ]
      }
    }
  ]
}
```
This defines a profile named "satb_choir," which splits the customary range of a mixed choir across four MIDI channels and sends all transformed messages to a virtual MIDI port named "MIDI Interceptor Output".

Take this as a starting point, adjust as needed, and __don't forget to set "MIDI Interceptor Output" (or whatever you named it) as a MIDI input in your DAW/sequencer/notation editor__.

### Additional options
In the `settings` section of the configuration file you can also add these keys:
* `inputPortsExclusions`: use it to exclude certain MIDI ports, by their name. Supports the wildcards `*` and `?` that match _any chars_ and _any char_, respectively. _Excluding_ a port prevents `midi-interceptor` from listening to it, thus __leaving that port available for other applications to use__. Example:
```json
"inputPortsExclusions": ["Akai MPK Mini", "Native Instruments*", "Alesis V??"]
```
* `debug`: use it to cause incoming __Note On__ and __Note Off__ messages to be printed to the console, along with any rerouting they are affected by. Example:
```json
"debug": true
```
> Note: for infrequent use, it is better to provide `debug` as a command line argument rather than a configuration file setting.

> Note: A `virtualOutputName` is mandatory; `midi-interceptor` __will exit with an error if one is not provided__.

> Note: Ensure the `midi-interceptor.config` file contains valid JSON. Use a JSON validator like the one from [curiousconcept](https://jsonformatter.curiousconcept.com) if unsure.

## Execution
Run the `midi-interceptor` application from the command line. Ensure the MIDI gear you want to intercept is plugged in and turned on, then run, e.g.:
```bash
midi-interceptor --cp=satb_choir
```
> Note: You can override any setting from the __configuration file__ via the __command line__. For example, to specify on-the-fly a different virtual output you would do:
```batch
midi-interceptor --cp=satb_choir --virtualOutputName="my Other Virtual Port"
```
on __Windows__, or
```bash
midi-interceptor --cp=satb_choir --virtualOutputName=my\ Other\ Virtual\ Port
```
on __macOs__/__Linux__.

### The `default` profile
__You can define a profile named "default" in your configuration file.__ This profile will be loaded automatically and serve as the base for any subsequent settings given in another profile (loaded via `--cp`) or specified on the command line.  Here’s how you can use this to your advantage:
* __Single Profile Use:__ If you only plan to use one profile, name it _default_ and include all your settings there. This way, you can run `midi-interceptor` without any arguments:
```bash
midi-interceptor
```
* __Common Settings:__ If you have settings that should apply across multiple profiles, place them in the _default_ profile.

### Accessing the Built-in Documentation
To view the documentation for all supported settings, run the following command in your console:
```bash
midi-interceptor --h
```

## Other considerations
This open-source project is still in its early stages. Any help is appreciated. Feel free to [report bugs and suggest features](https://github.com/ciacob/midi-interceptor/issues), or fork the code and send pull requests.

## License
This project is licensed under the [MIT License](https://github.com/ciacob/midi-interceptor?tab=MIT-1-ov-file).