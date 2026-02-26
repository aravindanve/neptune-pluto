const initialCameraPosition = [0, -90, 30];
const initialControllerValues = {
  Speed: 15000,
  Stars: true,
  Asteroids: true,
  Labels: false,
  Orbits: true,
  Track: "None",
  GhostCamera: false,
  Debug: {
    ShowAxes: false,
  },
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

// create objects
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

/** @type {import("spacekit.js").THREE} */
const THREE = Spacekit.THREE;

const sunMesh = sun.get3jsObjects()[0];
const camera = viz.getViewer().get3jsCamera();
const cameraControls = viz.getViewer().get3jsCameraControls();

// create helpers
const cameraUpHelper = new THREE.ArrowHelper(camera.up.clone().normalize(), undefined, 8, 0xffaa00);

const ghostCameraLensOutline = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.ConeGeometry(2, 4, 6, 1)),
  new THREE.MeshBasicMaterial({ color: 0xffaa00 }),
);

ghostCameraLensOutline.rotateX(-Math.PI / 2);
ghostCameraLensOutline.position.set(0, 0, -2);

const ghostCameraBodyOutline = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(4, 4, 6)),
  new THREE.MeshBasicMaterial({ color: 0xffaa00 }),
);

ghostCameraBodyOutline.position.set(0, 0, -7);

const ghostCamera = new THREE.Group().add(ghostCameraLensOutline, ghostCameraBodyOutline);

ghostCamera.position.copy(camera.position);
ghostCamera.up.copy(camera.up);

const ghostCameraPositionHelper = new THREE.ArrowHelper(
  ghostCamera.position.clone().normalize(),
  undefined,
  ghostCamera.position.length(),
  0xffaa00,
  0,
  0,
);

// create gui controllers

/** @type {import('dat.gui').GUI} */
const gui = new dat.GUI();
const guiState = {
  ...initialControllerValues,
  Debug: {
    ...initialControllerValues.Debug,
  },
};

const handleSpeedChange = (val) => {
  viz.setJdPerSecond(val);
};

const speedController = gui
  .add(guiState, "Speed", 0, 1e5)
  .onChange(handleSpeedChange)
  .setValue(guiState.Speed)
  .listen();

const handleStarsChange = (val) => {
  if (val) {
    viz.addObject(stars, true);
  } else {
    viz.removeObject(stars);
  }
};
const starsController = gui.add(guiState, "Stars", true).onChange(handleStarsChange).setValue(guiState.Stars).listen();

const handleAsteroidsChange = (val) => {
  if (val) {
    viz.addObject(asteroid2025mh348);
    asteroid2025mh348.setLabelVisibility(guiState.Labels); // FIXME: label still gets lost
  } else {
    viz.removeObject(asteroid2025mh348);
  }
};

const asteroidsController = gui
  .add(guiState, "Asteroids", true)
  .onChange(handleAsteroidsChange)
  .setValue(guiState.Asteroids)
  .listen();

const handleLabelsChange = (val) => {
  neptune.setLabelVisibility(val);
  pluto.setLabelVisibility(val);
  asteroid2025mh348.setLabelVisibility(val);
};

const labelsController = gui
  .add(guiState, "Labels", true)
  .onChange(handleLabelsChange)
  .setValue(guiState.Labels)
  .listen();

const handleOrbitsChange = (val) => {
  for (const planet of planets) {
    planet.getOrbit().setVisibility(val);
  }

  neptune.getOrbit().setVisibility(val);
  pluto.getOrbit().setVisibility(val);
  asteroid2025mh348.getOrbit().setVisibility(val);
};

const orbitsController = gui
  .add(guiState, "Orbits", true)
  .onChange(handleOrbitsChange)
  .setValue(guiState.Orbits)
  .listen();

/** @type {Record<string, import("spacekit.js").SphereObject>} */
const trackableObjects = {
  None: undefined,
  Neptune: neptune,
  Pluto: pluto,
  ["2025 MH348"]: asteroid2025mh348,
};

const updateCameraHelpers = (cameraOrGhostCamera) => {
  cameraUpHelper.setDirection(cameraOrGhostCamera.up.clone());
  ghostCamera.lookAt(sunMesh.position);
  ghostCameraPositionHelper.setDirection(cameraOrGhostCamera.position.clone().normalize());
  ghostCameraPositionHelper.setLength(cameraOrGhostCamera.position.length(), 0, 0);
};

const handleTrackChange = (val) => {
  const cameraOrGhostCamera = guiState.GhostCamera ? ghostCamera : camera;

  if (val === "None") {
    // calculate camera up rotation to align with global z axis
    const cameraUpRotation = new THREE.Quaternion().setFromUnitVectors(
      cameraOrGhostCamera.up.clone().normalize(),
      new THREE.Vector3(0, 0, 1),
    );

    // set camera up rotation to align with global z axis
    // TODO: set camera position in such a way that the object remains in the same position,
    // but every other object and orbits jump to accomodate the new perspective
    cameraOrGhostCamera.up.applyQuaternion(cameraUpRotation);

    // update camera helpers
    updateCameraHelpers(cameraOrGhostCamera);

    // update camera controls
    cameraControls.update();

    // update camera matrix
    camera.updateMatrixWorld();

    // stop tracking object with camera
    viz.onTick = null;

    //
  } else {
    const object = trackableObjects[val];
    const objectMesh = object.get3jsObjects()[0];

    // calculate object orbit normal
    const objectOrbitShape = object.getOrbit().getOrbitShape();
    const objectOrbitGeometryPosition = objectOrbitShape.geometry.attributes.position;

    const objectOrbitNormal = new THREE.Vector3().crossVectors(
      new THREE.Vector3().fromBufferAttribute(objectOrbitGeometryPosition, 0),
      new THREE.Vector3().fromBufferAttribute(objectOrbitGeometryPosition, 1),
    );

    // calculate camera up rotation to align with object orbit normal
    const cameraUpRotation = new THREE.Quaternion().setFromUnitVectors(
      cameraOrGhostCamera.up.clone().normalize(),
      objectOrbitNormal.clone().normalize(),
    );

    // set camera up rotation to align with object orbit normal
    // TODO: set camera position in such a way that the object remains in the same position,
    // but every other object and orbits jump to accomodate the new perspective
    cameraOrGhostCamera.up.applyQuaternion(cameraUpRotation);

    // update camera helpers
    updateCameraHelpers(cameraOrGhostCamera);

    // update camera controls
    cameraControls.update();

    // update camera matrix
    camera.updateMatrixWorld();

    let objectPositionOld = objectMesh.position.clone();

    // start tracking object with camera while keeping the sun at the center
    viz.onTick = () => {
      const objectPositionNew = objectMesh.position.clone();
      const cameraOrGhostCamera = guiState.GhostCamera ? ghostCamera : camera;

      // compute old sun to object vector
      const sunToObjectOld = objectPositionOld.clone().sub(sunMesh.position);

      // compute new sun to object vector
      const sunToObjectNew = objectPositionNew.clone().sub(sunMesh.position);

      // compute sun to object vector rotation
      const sunToObjectRotation = new THREE.Quaternion().setFromUnitVectors(
        sunToObjectOld.clone().normalize(),
        sunToObjectNew.clone().normalize(),
      );

      // compute sun to object vector scale factor
      const sunToObjectScaleFactor =
        sunToObjectOld.length() !== 0 ? sunToObjectNew.length() / sunToObjectOld.length() : 1;

      // compute new sun to cam vector by applying rotation and scale factor
      const sunToCamNew = cameraOrGhostCamera.position
        .clone()
        .applyQuaternion(sunToObjectRotation)
        .multiplyScalar(sunToObjectScaleFactor);

      // set new sun to cam vector as camera position
      cameraOrGhostCamera.position.copy(sunToCamNew);

      // set roll to cam by applying the same rotation
      // NOTE: this prevents the planet from wobbling due to an inclined axis.
      // this wobble presents as a rocking motion about the sun, starting with
      // none at the center and growing more exaggerated as you move away from
      // the center, be it vertically or horizontally.
      cameraOrGhostCamera.up.applyQuaternion(sunToObjectRotation);

      // update camera helpers
      updateCameraHelpers(cameraOrGhostCamera);

      // update camera controls
      cameraControls.update();

      // update camera matrix
      camera.updateMatrixWorld();

      // update old object position
      objectPositionOld = objectPositionNew.clone();
    };
  }
};

const trackController = gui
  .add(guiState, "Track", Object.keys(trackableObjects))
  .onChange(handleTrackChange)
  .setValue(guiState.Track)
  .listen();

const handleGhostCameraChange = (val) => {
  if (val) {
    // update ghost camera to assume camera position and up
    ghostCamera.position.copy(camera.position);
    ghostCamera.up.copy(camera.up);

    // update camera helpers
    updateCameraHelpers(ghostCamera);

    // add ghost camera to scene
    viz.getScene().add(ghostCamera);
    viz.getScene().add(ghostCameraPositionHelper);
  } else {
    // remove ghost camera
    viz.getScene().remove(ghostCamera);
    viz.getScene().remove(ghostCameraPositionHelper);

    // update camera to assume ghost camera position and up
    camera.position.copy(ghostCamera.position);
    camera.up.copy(ghostCamera.up);

    // update camera helpers
    updateCameraHelpers(ghostCamera);
  }
};

gui
  .add(guiState, "GhostCamera", false)
  .name("Ghost Camera")
  .onChange(handleGhostCameraChange)
  .setValue(guiState.GhostCamera)
  .listen();

const handleReset = () => {
  const cameraOrGhostCamera = guiState.GhostCamera ? ghostCamera : camera;

  // set speed to initial value
  speedController.setValue(initialControllerValues.Speed);

  // set camera position to initial
  cameraOrGhostCamera.position.set(...initialCameraPosition);

  // set camera up to initial
  cameraOrGhostCamera.up.copy(sunMesh.up);

  // update camera helpers
  updateCameraHelpers(cameraOrGhostCamera);

  // update camera controls
  cameraControls.update();

  // update camera matrix
  camera.updateMatrixWorld();
};

gui.add({ Reset: handleReset }, "Reset").name("Reset Speed and Camera");

const debugFolder = gui.addFolder("Debug");

// x is red, y is green, z is blue
const axesHelperBase = new THREE.AxesHelper(5);

/** @type {[[import("three").Object3D, import("three").Object3D]]} */
const axesHelperParentsAndHelpers = [];

const handleShowAxesChange = (val) => {
  if (val) {
    // add axes helper for scene
    const sceneAxesHelper = axesHelperBase.clone();
    const scene = viz.getScene().add(sceneAxesHelper);

    axesHelperParentsAndHelpers.push([scene, sceneAxesHelper]);

    // add camera up helper
    scene.add(cameraUpHelper);

    axesHelperParentsAndHelpers.push([scene, cameraUpHelper]);

    // add axes helper for ghost camera
    const ghostCameraAxesHelper = axesHelperBase.clone();
    ghostCamera.add(ghostCameraAxesHelper);

    axesHelperParentsAndHelpers.push([ghostCamera, ghostCameraAxesHelper]);

    // add axes helpers for trackable objects
    for (const object of Object.values(trackableObjects)) {
      if (!object) continue;

      // add axes helper for object
      const objectAxesHelper = axesHelperBase.clone();
      const objectMesh = object.get3jsObjects()[0].add(objectAxesHelper);

      axesHelperParentsAndHelpers.push([objectMesh, objectAxesHelper]);

      // add normal for object orbit
      const objectOrbit = object.getOrbit();
      const objectOrbitShape = objectOrbit.getOrbitShape();
      const objectOrbitGeometryPosition = objectOrbitShape.geometry.attributes.position;

      const objectOrbitNormal = new THREE.Vector3().crossVectors(
        new THREE.Vector3().fromBufferAttribute(objectOrbitGeometryPosition, 0),
        new THREE.Vector3().fromBufferAttribute(objectOrbitGeometryPosition, 1),
      );

      const objectOrbitNormalHelper = new THREE.ArrowHelper(
        objectOrbitNormal.clone().normalize(),
        undefined,
        5,
        objectOrbit.getHexColor(),
      );

      const scene = viz.getScene().add(objectOrbitNormalHelper);

      axesHelperParentsAndHelpers.push([scene, objectOrbitNormalHelper]);
    }
  } else {
    for (const [parent, helper] of axesHelperParentsAndHelpers) {
      parent.remove(helper);
    }
  }
};

debugFolder
  .add(guiState.Debug, "ShowAxes", true)
  .name("Show Axes")
  .onChange(handleShowAxesChange)
  .setValue(guiState.Debug.ShowAxes)
  .listen();
