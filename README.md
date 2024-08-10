# midi-interceptor
A small Node.js application that listens to all available MIDI input devices, processes the incoming messages, and sends them to a virtual MIDI output that can be used by your DAW as a MIDI input source.

Currently, the application merges MIDI inputs and splits incoming Note On and Note Off messages across the first four MIDI channels. This allows for flexible routing and management of MIDI data within your DAW

> Note: it needs changes to work on macOS and/or Linux. Currently only works on Windows, with [loopmidi](https://www.tobias-erichsen.de/software/loopmidi.html), which you need to install, and, in-there, create one `loopback MIDI port` named __MIDI Interceptor Output__, precisely.

You're welcome to fork the code an play with it at will.
