const initialCameraPosition = [0, -90, 30];
const initialControllerValues = {
  Speed: 15000,
  Stars: true,
  Asteroids: true,
  Labels: false,
  Orbits: true,
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

/** @type {import("spacekit.js").Ephem} */
const Ephem = Spacekit.Ephem;

const stars = viz.createStars();

const sun = viz.createObject("sun", {
  ...SpaceObjectPresets.SUN,
  scale: [10, 10, 10],
});

const particleSize = 10;

const planets = [
  viz.createObject("mercury", { ...SpaceObjectPresets.MERCURY, particleSize }),
  viz.createObject("venus", { ...SpaceObjectPresets.VENUS, particleSize }),
  viz.createObject("earth", { ...SpaceObjectPresets.EARTH, particleSize }),
  viz.createObject("mars", { ...SpaceObjectPresets.MARS, particleSize }),
  viz.createObject("jupiter", { ...SpaceObjectPresets.JUPITER, particleSize }),
  viz.createObject("saturn", { ...SpaceObjectPresets.SATURN, particleSize }),
  viz.createObject("uranus", { ...SpaceObjectPresets.URANUS, particleSize }),
];

const neptune = viz.createSphere("neptune", {
  labelText: "Neptune",
  ephem: EphemPresets.NEPTUNE,
  color: 0x465ef0,
  radius: 1,
  theme: {
    orbitColor: 0x465ef0,
  },
});

const pluto = viz.createSphere("pluto", {
  labelText: "Pluto",
  ephem: EphemPresets.PLUTO,
  color: 0xff0000,
  radius: 0.5,
  theme: {
    orbitColor: 0xff0000,
  },
});

const asteroid2025mh348 = viz.createSphere("asteroid2025mh348", {
  labelText: "2025 MH348",
  // source https://ssd.jpl.nasa.gov/horizons/app.html
  ephem: new Ephem(
    {
      epoch: 2461000.5,
      a: 30.2391154,
      e: 9.158040000000001e-2,
      i: 28.71388,
      om: 154.86405,
      w: 75.78133, //
      ma: 76.27347,
    },
    "deg",
    true,
  ),
  color: 0xffffff,
  radius: 0.25,
  theme: {
    orbitColor: 0xffffff,
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

gui.add(guiState, "Asteroids", true).onChange((val) => {
  if (val) {
    viz.addObject(asteroid2025mh348);
  } else {
    viz.removeObject(asteroid2025mh348);
  }
});

const setLabelVisibility = (val) => {
  neptune.setLabelVisibility(val);
  pluto.setLabelVisibility(val);
  asteroid2025mh348.setLabelVisibility(val);
};

setLabelVisibility(false);
gui.add(guiState, "Labels", false).onChange((val) => {
  setLabelVisibility(val);
});

const setOrbitVisibility = (val) => {
  planets.map((it) => it.getOrbit().setVisibility(val));
  neptune.getOrbit().setVisibility(val);
  pluto.getOrbit().setVisibility(val);
  asteroid2025mh348.getOrbit().setVisibility(val);
};

gui.add(guiState, "Orbits", true).onChange((val) => {
  setOrbitVisibility(val);
});

/** @type {import("spacekit.js").THREE} */
const THREE = Spacekit.THREE;

const sunMesh = sun.get3jsObjects()[0];
const camera = viz.getViewer().get3jsCamera();
const cameraControls = viz.getViewer().get3jsCameraControls();

const trackableObjects = {
  None: undefined,
  Neptune: neptune,
  Pluto: pluto,
  ["2025 MH348"]: asteroid2025mh348,
};

gui.add(guiState, "Track", Object.keys(trackableObjects)).onChange((val) => {
  if (val === "None") {
    // stop tracking object with camera
    viz.onTick = null;

    //
  } else {
    const objectMesh = trackableObjects[val].get3jsObjects()[0];

    let objectPositionOld = objectMesh.position.clone();

    // start tracking object with camera while keeping the sun at the center
    viz.onTick = () => {
      const objectPositionNew = objectMesh.position.clone();

      // compute old sun to object vector
      const sunToNeptuneOld = objectPositionOld.clone().sub(sunMesh.position);

      // compute new sun to object vector
      const sunToNeptuneNew = objectPositionNew.clone().sub(sunMesh.position);

      // compute sun to object vector rotation
      const sunToNeptuneRotation = new THREE.Quaternion().setFromUnitVectors(
        sunToNeptuneOld.clone().normalize(),
        sunToNeptuneNew.clone().normalize(),
      );

      // compute sun to object vector scale factor
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

      // update old object position
      objectPositionOld = objectPositionNew.clone();
    };
  }
});

const guiReset = {
  Reset: () => {
    // set speed to initial value
    speedController.setValue(initialControllerValues.Speed);

    // set camera position to initial
    camera.position.set(...initialCameraPosition);

    // set camera up to initial
    camera.up.copy(sunMesh.up);

    // update camera controls
    cameraControls.update();

    // update camera matrix
    camera.updateMatrixWorld();
  },
};

gui.add(guiReset, "Reset").name("Reset Speed and Camera");
