# midi-interceptor

A small Node.js application that listens to all available MIDI input devices, processes the incoming messages, and sends them to a virtual MIDI output that can be used by your DAW as a MIDI input source.

Currently, the application merges MIDI inputs and splits incoming Note On and Note Off messages across the first four MIDI channels. This allows for flexible routing and management of MIDI data within your DAW.

> **Note**: This application currently only works on Windows and requires [loopMIDI](https://www.tobias-erichsen.de/software/loopmidi.html). To use it, install loopMIDI and create a loopback MIDI port named **MIDI Interceptor Output**.

You're welcome to fork the code and play with it at will.
