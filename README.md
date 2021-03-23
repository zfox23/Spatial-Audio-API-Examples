# Spatial Audio API Examples
This repository contains example projects that make use of the [Spatial Audio API](https://highfidelity.com/api/).

These example projects augment the API walkthrough guides you can find at [highfidelity.com/api/guides](https://www.highfidelity.com/api/guides).

**We would love your contributions!** If you're interested in submitting an example application of your own, open a pull request against this repository.

# The `examples` Directory
😎 The `examples` directory of this repository contains complete, commented, tested example projects that import the High Fidelity Spatial Audio Client Library.

## Plain HTML/JS Examples
### [bots](./examples/web/bots/)
Listen to a simulated conversation between bots as they walk around you in this virtual space.
### [complex](./examples/web/complex/)
A more complicated version of [the simple Web App](./examples/web/simple/), with more user controls and UI.
### [dots](./examples/web/dots/)
A basic, but complete, 2D multi-user spatialized sound demo, in less than 600 lines of code.
### [simple](./examples/web/simple/)
Corresponds to the "Build a Simple Web App" guide at [highfidelity.com/api/guides/web/simple](https://www.highfidelity.com/api/guides/web/simple).
### [simple-with-device-selection](./examples/web/simple-with-device-selection/)
Similar to the "simple" example above, except this one allows a user to select their audio input/output devices dynamically.
### [subscriptions](./examples/web/subscriptions/)
This project exemplifies how to make use of [User Data Subscriptions](https://docs.highfidelity.com/latest/modules/classes_hifiuserdatasubscription.html) in projects that use the Spatial Audio API.
### [tracks](./examples/web/tracks/)
A multi-track spatial audio demo.
### [player](./examples/web/player/)
Multiple users can connect simultaneously, move around and communicate using spatialized audio.

## NodeJS Examples
### [DJ Bot](./examples/nodejs/djBot)
Corresponds to the "Make a DJ Bot" guide at [highfidelity.com/api/guides/nodejs/djBot](https://www.highfidelity.com/api/guides/nodejs/djBot).
### [Express Webapp](./examples/nodejs/express-webapp)
Corresponds to the "Build a Web App with the Spatial Audio API, Express, and EJS" guide at [highfidelity.com/api/guides/nodejs/express](https://www.highfidelity.com/api/guides/nodejs/express).
### [Get a JWT](./examples/nodejs/express-webapp)
Corresponds to the "Get a JWT" guide at [highfidelity.com/api/guides/misc/getAJWT](https://www.highfidelity.com/api/guides/misc/getAJWT).

# The `experiments` Directory
🐉 The `experiments` directory of this repository contains experimental example projects that import the High Fidelity Spatial Audio Client Library. These examples may not be documented as thoroughly as the above examples. Enjoy!

## Plain HTML/JS Experiments
### [Video Chat - TokBox](./experiments/web/videochat-tokbox)
Experience High Fidelity Spatial Audio with 2D video chat powered by TokBox.

## NodeJS Experiments
### [3D Dots](./experiments/web/dots3D)
Move around as dots in a 3D space with spatial audio.
### [Plaza](./experiments/nodejs/plaza)
Explore various environments connected in a grid with spatial audio between them.
### [Spatial Microphone](./experiments/nodejs/spatial-microphone)
Drop the Spatial Microphone in a High Fidelity Spatial Audio Space to record the audio in that Space from coordinates `(0, 0, 0)`. The Spatial Microphone saves audio recordings in `.wav` format by default.
### [Spatial Speaker Space](./experiments/nodejs/Spatial-Speaker-Space)
A comfortable virtual 3D audio environment for speakers and an audience that makes use advanced of High Fidelity's Spatial Audio API.
### [Spatial Watch Party](./experiments/nodejs/Spatial-Watch-Party)
A Web application that lets users watch synced YouTube videos together while chatting in a virtual 3D environment using High Fidelity's spatial audio technology.
### [StreetMeet](./experiments/nodejs/streetMeet)
Discover the entire world in 3D with others with High Fidelity Spatial Audio, Twilio and Google Street View.
### [Video Chat - Agora](./experiments/nodejs/videochat-agora)
Experience High Fidelity Spatial Audio with 2D video chat powered by Agora.
### [Video Chat - Daily](./experiments/nodejs/videochat-daily)
Experience High Fidelity Spatial Audio with 2D video chat powered by Daily.
### [Video Chat - Twilio](./experiments/nodejs/videochat-twilio)
Experience High Fidelity Spatial Audio with 2D video chat powered by Twilio.

## Minecraft Experiments
### [Minecraft Mod Example](./experiments/minecraft/hifimc)
Experience High Fidelity's spatial audio while playing Minecraft: Java Edition with others.

## Audio Environments
Featuring a combination of HTML/JS and NodeJS
### [Haunted Mansion Envrionment](./experiments/environments/mansion)
Explore a 3d auditory experience with your friends.
### [Office Envrionment](./experiments/environments/office)
Virtual office with walls and private rooms.

# Live Demos
This repository employs GitHub Pages, which means that you can look at some of these example applications live by browsing [this page](https://highfidelity.github.io/Spatial-Audio-API-Examples/).

**None of the example projects committed to this repository contain an embedded JWT, which means connecting to the Spatial Audio API Server from these live examples *will not work*.**

For more information about JWTs, see the "Authorized Access and JWTs" section of our [Spatial Audio FAQ](https://www.highfidelity.com/api-spatial-audio-faq).
