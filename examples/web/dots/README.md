# Dots: A basic, but complete, 2D multi-user spatialized sound demo.

Everything is drag and drop:
- Drag your dot to move.
- Drag on an mp3 to play it from that position, and anyone can drag it around afterwords. Gets deleted when you leave. (Opens a second connection to the mixer.)
- Drag an image to be the background (for everyone).
-  Drag an image onto yourself or any music to be the image. 
- ~~Change direction to face direction of drag.~~

Start in anteroom/lobby, showing how many in each room. Join the one you want.

Because there is no server, there are no accounts. Get assigned a name for the duration.

Beginning several seconds after you do speak in a room, you can kick out anyone in that room. You get kicked to the lobby (where there is no speaking), and you can rejoin the room, but beware that people can kick you before you have a chance to disrupt.

I don't want people to guess as to what is happening on the server, without being able to see the source, and I don't want the hassle of running a server. So I'm using Croquet.io SDK to have replicated behavior without a server.

# Demo

You can try this out directly [here](https://highfidelity.github.io/Spatial-Audio-API-Examples/examples/web/dots).

# Run your own

To make your own version:
- Get a High Fidelity developer account at [https://account.highfidelity.com/](https://account.highfidelity.com/), and create an app with three spaces.
- Check out or fork this repo.
- In your copy, edit `index.js` and edit the definition of `makeJWT`. For exammple, you could replace the fetch call with the commented-out code there and fill in your own `YOUR_ACCOUNT_SECRET` and `app_id` from the account you just made.
- Edit `index.html` and replace the `id` of the three `<room>` elements with your three space ids. If you are using the commented-out code in makeJWT, you will also want to uncomment the 


# Further Work

Ideas for further work, in addition to the ~~not-implemented~~ above:
- Mute.
- Allow users to change their gain.
- Persist your color/name for several minutes, so that people will recognize you after you refresh.
- Don't allow speaking for five seconds on joining.
- Persist your avatar image (indefinitely?), but then how do you remove it?
- Too easy to click instead of drag, bringing up file picker. Maybe instead have have a context menu by right-mouse/touch-hold?
- Something wacky with iphone dark-mode/invert-colors/text-shadows that doesn't differentiate kick enabled/disabled very well
- Forgot to make audio loop.
- Video: select a person to show their video. Select anyone who is sharing, but only one shown at a time to imit "Zoom fatigue".
- Zoom or limit travels? (relates to mobile screen size issues)
- QR code to share the "full screen" view with someone. But who is face2face any more?
- I'd like to highlight map and your own avatar as drop targets, depending on what is being dragged. But the dragleave fires on all subelements.
