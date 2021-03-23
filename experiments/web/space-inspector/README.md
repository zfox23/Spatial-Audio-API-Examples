# "Space Inspector" Example

![Space Inspector Example GIF](./screenshot.png)

## Author
Sam Gateau

## Usage
 'Space Inspector' is a tool allowing to connect into any High Fidelity Audio Space (HifiSpace) and inspect the state of the server
  as observed from the client api. Specify a valid JWT for the HifiSpace you want to inspect, connect and then appear
  To run the web app, spin a local http server on your computer (ex: python -m http.server) and navigate to the index.html page of the app.
  
- You need to specify a valid JWT for the 
- Edit this example's code `examples/web/player/index.html` and add your JWT `HIFI_AUDIO_JWT`
- Set up a simple HTTP server on the root directory. I.e. Using python: `python3 -m http.server 8080`
- Visit the example in your browser: `http://localhost:8080/examples/web/player/index.html`
- Click the connect button. The Communicator should connect.
- The Player node (you) should be situated on the center of the canvas.
- Received nodes should be rendered on the canvas.
- A grid should be renderer with colored square that indicate where others are.
- Select any Player with a mouse click to display their name.
- Use the WASD or arrow keys to control the player.
- Talk to others, and experience spatialized audio.