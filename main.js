const cameraInitialPosition = [0, -90, 30];

/** @type {import("spacekit.js").Simulation} */
const viz = new Spacekit.Simulation(document.getElementById("main-container"), {
  basePath: "https://typpo.github.io/spacekit/src",
  camera: {
    initialPosition: cameraInitialPosition,
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
  Speed: 15000,
  Stars: true,
  Anchor: "Sun",
};

viz.setJdPerSecond(guiState.Speed);
gui.add(guiState, "Speed", 0, 1e5).onChange((val) => {
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

gui.add(guiState, "Anchor", ["Sun", "Neptune"]).onChange((val) => {
  if (val === "Sun") {
    // set camera position
    camera.position.set(...cameraInitialPosition);

    // set camera target to sun
    cameraControls.target.set(0, 0, 0);
    cameraControls.update();

    // update camera matrix
    camera.updateMatrixWorld();

    // stop following neptune
    viz.onTick = null;

    //
  } else {
    // compute sun to neptune vector
    const sunToNeptune = new THREE.Vector3().subVectors(
      neptuneMesh.position,
      sunMesh.position,
    );

    // compute sun to cam vector
    const sunToCam = new THREE.Vector3(...cameraInitialPosition);

    // compute cam rotation
    const camRotation = new THREE.Quaternion().setFromUnitVectors(
      sunToCam.clone().setZ(0).normalize(),
      sunToNeptune.clone().setZ(0).normalize(),
    );

    // console.log(camRotation);

    // compute cam position vector by applying rotation
    const camPosition = sunToCam.clone().applyQuaternion(camRotation);

    // set cam to neptune as camera position
    camera.position.copy(camPosition);

    // set new target to neptune
    cameraControls.target.copy(neptuneMesh.position);
    cameraControls.update();

    // update camera matrix
    camera.updateMatrixWorld();

    // start following neptune keeping sun fixed
    viz.onTick = () => {
      const neptunePosOld = cameraControls.target;
      const neptunePosNew = neptuneMesh.position.clone();

      // compute old sun to neptune vector
      const sunToNeptuneOld = new THREE.Vector3().subVectors(
        neptunePosOld,
        sunMesh.position,
      );

      // compute new sun to neptune vector
      const sunToNeptuneNew = new THREE.Vector3().subVectors(
        neptunePosNew,
        sunMesh.position,
      );

      // compute sun to neptune vector rotation
      const sunToNeptuneRotation = new THREE.Quaternion().setFromUnitVectors(
        sunToNeptuneOld.clone().normalize(),
        sunToNeptuneNew.clone().normalize(),
      );

      // compute new cam to neptune vector by using old values and applying rotation
      const camToNeptuneNew = new THREE.Vector3()
        .subVectors(neptunePosOld, camera.position)
        .applyQuaternion(sunToNeptuneRotation);

      // compute new sun to cam vector
      const sunToCamNew = new THREE.Vector3().addVectors(
        sunToNeptuneNew,
        camToNeptuneNew.clone().negate(),
      );

      // set new sun to cam vector as camera position
      camera.position.copy(sunToCamNew);

      // set new target to neptune
      cameraControls.target.copy(neptunePosNew);
      cameraControls.update();

      // update camera matrix
      camera.updateMatrixWorld();
    };
  }
});
