let PARTICLES = {};
PARTICLES.DEFAULT_LINEAR_VELOCITY_M_PER_SEC = 3.6;
PARTICLES.MAX_LINEAR_VELOCITY_M_PER_SEC = 100;
PARTICLES.CLOSE_ENOUGH_ADD_M = 25;
PARTICLES.EASING = {
    "LINEAR": "linear",
    "EASE_OUT_QUAD": "easeOutQuad",
    "EASE_OUT_QUART": "easeOutQuart",
};

class Particle {
    constructor(params) {
        this.uuid = generateUUID();
        this.currentWorldPositionM = {
            "x": params.currentWorldPositionM ? params.currentWorldPositionM.x : undefined,
            "z": params.currentWorldPositionM ? params.currentWorldPositionM.z : undefined,
        };
        this.velocityMPerSec = {
            "x": params.velocityMPerSec ? params.velocityMPerSec.x : undefined,
            "z": params.velocityMPerSec ? params.velocityMPerSec.z : undefined
        };
        this.easing = params.easing ? params.easing : PARTICLES.EASING.LINEAR;
        this.dimensionsM = {
            "width": params.dimensionsM ? params.dimensionsM.width : undefined,
            "height": params.dimensionsM ? params.dimensionsM.height : undefined
        };
        this.image = new Image();
        this.image.src = params.imageSRC;
        this.createdAt = performance.now();
        this.lifespanMS = params.lifespanMS ? params.lifespanMS : -1;
        this.opacity = params.opacity ? params.opacity : 1.0;

        // The parameters below are used when `targetWorldPositionM` is set.
        this.targetWorldPositionM = {
            "x": params.targetWorldPositionM ? params.targetWorldPositionM.x : undefined,
            "z": params.targetWorldPositionM ? params.targetWorldPositionM.z : undefined
        };
        this.startWorldPositionM = {
            "x": undefined,
            "z": undefined
        };
        this.linearVelocityWithTarget = params.linearVelocityWithTarget ? params.linearVelocityWithTarget : PARTICLES.DEFAULT_LINEAR_VELOCITY_M_PER_SEC;
        this.easeTimeStartMS = undefined;
        this.easeDurationMS = undefined;
        this.easeTimeEndMS = undefined;
        this.targetMotionTimer = undefined;
        this.msAfterTargetReachedToDelete = params.msAfterTargetReachedToDelete ? params.msAfterTargetReachedToDelete : undefined;
    }
}

class ParticleController {
    constructor() {
        this.activeParticles = [];
    }

    addParticle(params) {
        this.activeParticles.push(new Particle(params));
        return this.activeParticles[this.activeParticles.length - 1].uuid;
    }

    deleteParticle(uuid) {
        let foundParticleIdx = this.activeParticles.findIndex((particle) => { return particle.uuid === uuid; });
        if (foundParticleIdx > -1) {
            if (this.activeParticles[foundParticleIdx].targetMotionTimer) {
                clearTimeout(this.activeParticles[foundParticleIdx].targetMotionTimer);
                this.activeParticles[foundParticleIdx].targetMotionTimer = false;
            }
            this.activeParticles.splice(foundParticleIdx, 1);
            return uuid;
        } else {
            return false;
        }
    }

    updateAllParticles(timestamp, deltaTimestampMS) {
        let now = performance.now();

        for (let i = 0; i < this.activeParticles.length; i++) {
            let particle = this.activeParticles[i];

            if (particle.lifespanMS > -1 && (particle.createdAt + particle.lifespanMS < now)) {
                this.deleteParticle(particle.uuid);
                i--;
                continue;
            }

            let newXZVelocity = {
                "x": 0,
                "z": 0
            };
            let maxLinearVelocity = PARTICLES.MAX_LINEAR_VELOCITY_M_PER_SEC;
            let distanceToTargetM;
            if (particle.targetWorldPositionM.x && particle.targetWorldPositionM.z) {
                let distanceToTargetMDelta = {
                    x: particle.targetWorldPositionM.x - particle.currentWorldPositionM.x,
                    z: particle.targetWorldPositionM.z - particle.currentWorldPositionM.z
                };
                let deltaX = particle.targetWorldPositionM.x ? distanceToTargetMDelta.x : 0.0;
                let deltaZ = particle.targetWorldPositionM.z ? distanceToTargetMDelta.z : 0.0;
                distanceToTargetM = Math.sqrt(Math.pow(distanceToTargetMDelta.x, 2) + Math.pow(distanceToTargetMDelta.z, 2));
                // Normalize deltas 
                newXZVelocity.x = particle.linearVelocityWithTarget * (deltaX / distanceToTargetM);
                newXZVelocity.z = particle.linearVelocityWithTarget * (deltaZ / distanceToTargetM);
                maxLinearVelocity = particle.linearVelocityWithTarget;
            } else if (particle.velocityMPerSec.x && particle.velocityMPerSec.z) {
                Object.assign(newXZVelocity, particle.velocityMPerSec);
            }

            let velocityMagnitudeMperSec = Math.sqrt(Math.pow(newXZVelocity.x, 2) + Math.pow(newXZVelocity.z, 2));
            if ((newXZVelocity.x === 0 && newXZVelocity.z === 0) ||
                (newXZVelocity.x === 0 && Math.abs(newXZVelocity.z) > 0) ||
                (Math.abs(newXZVelocity.x) > 0 && newXZVelocity.z === 0) ||
                velocityMagnitudeMperSec <= maxLinearVelocity) {
                // No-op
            } else {
                let denominator = Math.sqrt(Math.pow(newXZVelocity.x, 2) + Math.pow(newXZVelocity.z, 2));
                let newX = maxLinearVelocity * newXZVelocity.x / denominator;
                let newZ = maxLinearVelocity * newXZVelocity.z / denominator;
                newXZVelocity.x = newX;
                newXZVelocity.z = newZ;
            }

            Object.assign(particle.velocityMPerSec, newXZVelocity);
            velocityMagnitudeMperSec = Math.sqrt(Math.pow(particle.velocityMPerSec.x, 2) + Math.pow(particle.velocityMPerSec.z, 2));

            if (particle.targetWorldPositionM && !particle.targetMotionTimer) {
                Object.assign(particle.startWorldPositionM, particle.currentWorldPositionM);
                particle.easeTimeStartMS = now;
                particle.easeDurationMS = Math.round(distanceToTargetM / velocityMagnitudeMperSec * 1000);
                particle.easeTimeEndMS = particle.easeTimeStartMS + particle.easeDurationMS;
                particle.targetMotionTimer = setTimeout(() => {
                    particle.easeTimeStartMS = undefined;
                    particle.easeDurationMS = undefined;
                    particle.currentWorldPositionM = {
                        "x": particle.targetWorldPositionM.x,
                        "z": particle.targetWorldPositionM.z,
                    };
                    particle.targetWorldPositionM = {
                        "x": undefined,
                        "z": undefined,
                    };
                    particle.velocityMPerSec = {
                        "x": undefined,
                        "z": undefined,
                    };
                }, particle.easeDurationMS);

                if (particle.msAfterTargetReachedToDelete) {
                    particle.lifespanMS = particle.easeDurationMS + particle.msAfterTargetReachedToDelete;
                }
            }

            if (particle.velocityMPerSec.x || particle.velocityMPerSec.z) {
                if (particle.easing === PARTICLES.EASING.LINEAR) {
                    particle.currentWorldPositionM.x = particle.currentWorldPositionM.x + (particle.velocityMPerSec.x * deltaTimestampMS / TIME.MS_PER_SEC);
                    particle.currentWorldPositionM.z = particle.currentWorldPositionM.z + (particle.velocityMPerSec.z * deltaTimestampMS / TIME.MS_PER_SEC);
                } else if (particle.easing === PARTICLES.EASING.EASE_OUT_QUAD) {
                    particle.currentWorldPositionM.x = linearScale(easeOutQuad((now - particle.easeTimeStartMS) / particle.easeDurationMS), 0, 1, particle.startWorldPositionM.x, particle.targetWorldPositionM.x);
                    particle.currentWorldPositionM.z = linearScale(easeOutQuad((now - particle.easeTimeStartMS) / particle.easeDurationMS), 0, 1, particle.startWorldPositionM.z, particle.targetWorldPositionM.z);
                } else if (particle.easing === PARTICLES.EASING.EASE_OUT_QUART) {
                    particle.currentWorldPositionM.x = linearScale(easeOutQuart((now - particle.easeTimeStartMS) / particle.easeDurationMS), 0, 1, particle.startWorldPositionM.x, particle.targetWorldPositionM.x);
                    particle.currentWorldPositionM.z = linearScale(easeOutQuart((now - particle.easeTimeStartMS) / particle.easeDurationMS), 0, 1, particle.startWorldPositionM.z, particle.targetWorldPositionM.z);
                }
            }
        }
    }
}