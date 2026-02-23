const initialCameraPosition = [0, -90, 30];
const initialControllerValues = {
  Speed: 15000,
  Stars: true,
  Track: "None",
};

/** @type {import("spacekit.js").Simulation} */
const viz = new Spacekit.Simulation(document.getElementById("main-container"), {
  basePath: "https://typpo.github.io/spacekit/src",
  camera: {
    initialPosition: initialCameraPosition,
    enableDrift: false,
  },
});

/** @type {import("spacekit.js").SpaceObjectPresets} */
const SpaceObjectPresets = Spacekit.SpaceObjectPresets;

/** @type {import("spacekit.js").EphemPresets} */
const EphemPresets = Spacekit.EphemPresets;

const stars = viz.createStars();

const sun = viz.createObject("sun", {
  ...SpaceObjectPresets.SUN,
  scale: [10, 10, 10],
});

const particleSize = 10;

viz.createObject("mercury", { ...SpaceObjectPresets.MERCURY, particleSize });
viz.createObject("venus", { ...SpaceObjectPresets.VENUS, particleSize });
viz.createObject("earth", { ...SpaceObjectPresets.EARTH, particleSize });
viz.createObject("mars", { ...SpaceObjectPresets.MARS, particleSize });
viz.createObject("jupiter", { ...SpaceObjectPresets.JUPITER, particleSize });
viz.createObject("saturn", { ...SpaceObjectPresets.SATURN, particleSize });
viz.createObject("uranus", { ...SpaceObjectPresets.URANUS, particleSize });

const neptune = viz.createSphere("neptune", {
  ephem: EphemPresets.NEPTUNE,
  color: 0x465ef0,
  radius: 1,
  theme: {
    orbitColor: 0x465ef0,
  },
});

const pluto = viz.createSphere("pluto", {
  ephem: EphemPresets.PLUTO,
  color: 0xff0000,
  radius: 0.5,
  theme: {
    orbitColor: 0xff0000,
  },
});

/** @type {import('dat.gui').GUI} */
const gui = new dat.GUI();
const guiState = {
  ...initialControllerValues,
};

viz.setJdPerSecond(guiState.Speed);
const speedController = gui.add(guiState, "Speed", 0, 1e5).onChange((val) => {
  viz.setJdPerSecond(val);
});

gui.add(guiState, "Stars", true).onChange((val) => {
  if (val) {
    viz.addObject(stars, true);
  } else {
    viz.removeObject(stars);
  }
});

/** @type {import("spacekit.js").THREE} */
const THREE = Spacekit.THREE;

const sunMesh = sun.get3jsObjects()[0];
const neptuneMesh = neptune.get3jsObjects()[0];
const camera = viz.getViewer().get3jsCamera();
const cameraControls = viz.getViewer().get3jsCameraControls();

gui.add(guiState, "Track", ["None", "Neptune"]).onChange((val) => {
  if (val === "None") {
    // stop tracking neptune with camera
    viz.onTick = null;

    //
  } else {
    let neptunePositionOld = neptuneMesh.position.clone();

    // start tracking neptune with camera while keeping the sun at the center
    viz.onTick = () => {
      const neptunePositionNew = neptuneMesh.position.clone();

      // compute old sun to neptune vector
      const sunToNeptuneOld = neptunePositionOld.clone().sub(sunMesh.position);

      // compute new sun to neptune vector
      const sunToNeptuneNew = neptunePositionNew.clone().sub(sunMesh.position);

      // compute sun to neptune vector rotation
      const sunToNeptuneRotation = new THREE.Quaternion().setFromUnitVectors(
        sunToNeptuneOld.clone().normalize(),
        sunToNeptuneNew.clone().normalize(),
      );

      // compute sun to neptune vector scale factor
      const sunToNeptuneScaleFactor =
        sunToNeptuneOld.length() !== 0
          ? sunToNeptuneNew.length() / sunToNeptuneOld.length()
          : 1;

      // compute new sun to cam vector by applying rotation and scale factor
      const sunToCamNew = camera.position
        .clone()
        .applyQuaternion(sunToNeptuneRotation)
        .multiplyScalar(sunToNeptuneScaleFactor);

      // set new sun to cam vector as camera position
      camera.position.copy(sunToCamNew);

      // set roll to cam by applying the same rotation
      // NOTE: this prevents the planet from wobbling due to an inclined axis.
      // this wobble presents as a rocking motion about the sun, starting with
      // none at the center and growing more exaggerated as you move away from
      // the center, be it vertically or horizontally.
      camera.up.applyQuaternion(sunToNeptuneRotation);

      // update camera controls
      cameraControls.update();

      // update camera matrix
      camera.updateMatrixWorld();

      // update old neptune position
      neptunePositionOld = neptunePositionNew.clone();
    };
  }
});

const guiReset = {
  Reset: () => {
    // set speed to initial value
    speedController.setValue(initialControllerValues.Speed);

    // set camera position to initial
    camera.position.set(...initialCameraPosition);

    // update camera matrix
    camera.updateMatrixWorld();
  },
};

gui.add(guiReset, "Reset").name("Reset Speed and Camera");
