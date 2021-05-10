import { Point3D } from "hifi-spatial-audio";
import { PARTICLES } from "../constants/constants";
import { Utilities } from "../utilities/Utilities";

export class Particle {
    uuid: string;
    currentWorldPositionM: Point3D;
    velocityMPerSec: Point3D;
    easing: (t: number) => number;
    dimensionsM: Point3D;
    image: HTMLImageElement;
    createdAt: number;
    lifespanMS: number;
    opacity: number;
    targetWorldPositionM: Point3D;
    startWorldPositionM: Point3D;
    linearVelocityWithTarget?: number;
    easeTimeStartMS: number;
    easeDurationMS: number;
    easeTimeEndMS: number;
    targetMotionTimer: NodeJS.Timeout;
    msAfterTargetReachedToDelete: number;

    constructor({
        currentWorldPositionM = new Point3D(),
        velocityMPerSec = new Point3D(),
        easing = PARTICLES.EASING.LINEAR,
        dimensionsM = new Point3D(),
        imageSRC,
        lifespanMS = -1,
        opacity = 1.0,
        targetWorldPositionM,
        linearVelocityWithTarget = PARTICLES.DEFAULT_LINEAR_VELOCITY_M_PER_SEC,
        msAfterTargetReachedToDelete,
    }: {
        currentWorldPositionM?: Point3D,
        velocityMPerSec?: Point3D,
        easing?: (t: number) => number,
        dimensionsM?: Point3D,
        imageSRC: string,
        lifespanMS?: number,
        opacity?: number,
        targetWorldPositionM?: Point3D,
        linearVelocityWithTarget?: number,
        msAfterTargetReachedToDelete?: number
    }) {
        this.uuid = Utilities.generateUUID();
        this.currentWorldPositionM = currentWorldPositionM;
        this.velocityMPerSec = velocityMPerSec;
        this.easing = easing;
        this.dimensionsM = dimensionsM;
        this.image = new Image();
        this.image.src = imageSRC;
        this.createdAt = performance.now();
        this.lifespanMS = lifespanMS;
        this.opacity = opacity;

        // The parameters below are used when `targetWorldPositionM` is set.
        this.targetWorldPositionM = targetWorldPositionM;
        this.startWorldPositionM = new Point3D({ "x": undefined, "z": undefined });
        this.linearVelocityWithTarget = linearVelocityWithTarget;
        this.easeTimeStartMS = undefined;
        this.easeDurationMS = undefined;
        this.easeTimeEndMS = undefined;
        this.targetMotionTimer = undefined;
        this.msAfterTargetReachedToDelete = msAfterTargetReachedToDelete;
    }
}

export class ParticleController {
    activeParticles: Array<Particle>;

    constructor() {
        this.activeParticles = [];
    }

    addParticle(particle: Particle) {
        this.activeParticles.push(particle);
        return this.activeParticles[this.activeParticles.length - 1].uuid;
    }

    deleteParticle(uuid: string) {
        let foundParticleIdx = this.activeParticles.findIndex((particle) => { return particle.uuid === uuid; });
        if (foundParticleIdx > -1) {
            if (this.activeParticles[foundParticleIdx].targetMotionTimer) {
                clearTimeout(this.activeParticles[foundParticleIdx].targetMotionTimer);
                this.activeParticles[foundParticleIdx].targetMotionTimer = undefined;
            }
            this.activeParticles.splice(foundParticleIdx, 1);
            return uuid;
        } else {
            return false;
        }
    }

    updateAllParticles(timestamp: number, deltaTimestampMS: number) {
        let now = performance.now();

        for (let i = 0; i < this.activeParticles.length; i++) {
            let particle = this.activeParticles[i];

            if (particle.lifespanMS > -1 && (particle.createdAt + particle.lifespanMS < now)) {
                this.deleteParticle(particle.uuid);
                i--;
                continue;
            }

            let newXZVelocity = new Point3D({
                "x": 0,
                "z": 0
            });
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
                    particle.currentWorldPositionM = new Point3D({
                        "x": particle.targetWorldPositionM.x,
                        "z": particle.targetWorldPositionM.z,
                    });
                    particle.targetWorldPositionM = new Point3D({
                        "x": undefined,
                        "z": undefined,
                    });
                    particle.velocityMPerSec = new Point3D({
                        "x": undefined,
                        "z": undefined,
                    });
                }, particle.easeDurationMS);

                if (particle.msAfterTargetReachedToDelete) {
                    particle.lifespanMS = particle.easeDurationMS + particle.msAfterTargetReachedToDelete;
                }
            }

            if (particle.velocityMPerSec.x || particle.velocityMPerSec.z) {
                particle.currentWorldPositionM.x = Utilities.linearScale(particle.easing((now - particle.easeTimeStartMS) / particle.easeDurationMS), 0, 1, particle.startWorldPositionM.x, particle.targetWorldPositionM.x);
                particle.currentWorldPositionM.z = Utilities.linearScale(particle.easing((now - particle.easeTimeStartMS) / particle.easeDurationMS), 0, 1, particle.startWorldPositionM.z, particle.targetWorldPositionM.z);
            }
        }
    }
}
