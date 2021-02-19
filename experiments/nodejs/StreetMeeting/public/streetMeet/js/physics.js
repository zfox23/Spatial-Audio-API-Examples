
// Class that manages the physics loop
// Steps are based on the system's requestAnimationFrame
export class PhysicsLoop {
    constructor() {
        this.deltaTimeSec = 0;
        this.previousTime = 0;
        this.onStep = {};
        this.isRunning = false;
    }
    // Subscribe to the step callback
    addOnStepCback(name, cback) {
        this.onStep[name] = cback;
    }
    // Unsubscribe to the step callback
    removeOnStepCback(name) {
        if (this.onStep.hasOwnProperty(name)) {
            delete this.onStep[name];
        }
    }
    // Start the Physics loop
    start() {
        this.isRunning = true;
        this._startPhysicsLoop();
    }
    // Stop the Physics loop
    stop() {
        this.isRunning = false;
    }
    // Compute current delta time in seconds
    _updateDeltaTime() {
        let timeNow = Date.now();
        this.deltaTimeSec = (timeNow - this.previousTime) / 1000.0;
        this.previousTime = timeNow;
    }
    // Start the loop
    _startPhysicsLoop() {
        this._updateDeltaTime();
        for (let [name, cback] of Object.entries(this.onStep)) {
            cback(this.deltaTimeSec); // Send deltatime to subscribers
        }
        if (this.isRunning) { // Request another frame is running
            window.requestAnimationFrame(this._startPhysicsLoop.bind(this));
        }        
    }
}