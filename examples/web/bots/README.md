# "Bots" Example

## Author
Luis Cuenca

## Usage
- Edit this example's code `examples/web/bots/index.html` and add your JWT `HIFI_AUDIO_JWT`
- Set up a simple HTTP server on the root directory. I.e. Using python: `python3 -m http.server 8080`
- Visit the example in your browser: `http://localhost:8080/examples/web/bots/index.html`
- Click the connect button. Nodes should start connecting one by one.
- The Listener node (you) should be situated on the center of the canvas.
- The Bots (Emitters) should be gathered around a point on the canvas.
- Select any node with a mouse click. That node's log entry should highlight.
- Move the listener with a mouse left drag.
- Rotate the listener with a mouse right drag or click.
- Bots can't be moved, however the bots will gather around the listener sometimes.
- Experience spatialized audio according to the scene's setup.