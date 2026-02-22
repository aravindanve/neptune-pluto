const initialCameraPosition = [0, -90, 30];
const initialControllerValues = {
  Speed: 15000,
  Stars: true,
  Anchor: "None",
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

gui.add(guiState, "Anchor", ["None", "Neptune"]).onChange((val) => {
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

      // // compute sun to neptune vector rotation
      // const sunToNeptuneRotation = new THREE.Quaternion().setFromUnitVectors(
      //   sunToNeptuneOld.clone().normalize(),
      //   sunToNeptuneNew.clone().normalize(),
      // );

      // NOTE: high precision does not seem to make any difference!
      // compute sun to neptune vector rotation (with high precision)
      const sunToNeptuneRotation = makePreciseQuaternionFromVector3s(
        sunToNeptuneOld.clone(),
        sunToNeptuneNew.clone(),
      );

      // // compute new sun to cam vector by using old values and applying rotation
      // const sunToCamNew = camera.position
      //   .clone()
      //   .applyQuaternion(sunToNeptuneRotation);

      // NOTE: high precision does not seem to make any difference!
      // compute new sun to cam vector by using old values and applying rotation (with high precision)
      const sunToCamNew = applyPreciseQuaternionToVector3(
        camera.position.clone(),
        sunToNeptuneRotation,
      );

      // set new sun to cam vector as camera position
      camera.position.copy(sunToCamNew);

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
// high precision versions of quaternion math to prevent wobble while tracking rotation
// for benchmarks ref https://florissteenkamp.github.io/big-float-benchmark/

/** @typedef {import('decimal.js').Decimal} Decimal */
/** @typedef {typeof import('decimal.js').Decimal} DecimalStatic */
/** @typedef {{ x: Decimal; y: Decimal; z: Decimal; w: Decimal }} PreciseQuaternion */
/** @type {DecimalStatic} */
var Decimal;

Decimal.set({ precision: 100 });

// ref https://github.com/mrdoob/three.js/blob/dev/src/math/Quaternion.js#L471
/**
 * @param {import("three").Vector3} vFrom
 * @param {import("three").Vector3} vTo
 * @returns {PreciseQuaternion}
 */
const makePreciseQuaternionFromVector3s = (vFrom, vTo) => {
  /** @type {PreciseQuaternion} */
  const q = {};

  // normalize vFrom and vTo
  const vfx = Decimal(vFrom.x).div(vFrom.length() || 1),
    vfy = Decimal(vFrom.y).div(vFrom.length() || 1),
    vfz = Decimal(vFrom.z).div(vFrom.length() || 1),
    vtx = Decimal(vTo.x).div(vTo.length() || 1),
    vty = Decimal(vTo.y).div(vTo.length() || 1),
    vtz = Decimal(vTo.z).div(vTo.length() || 1);

  let r = Decimal.sum(
    vfx.mul(Decimal(vtx)),
    vfy.mul(Decimal(vty)),
    vfz.mul(Decimal(vtz)),
    1,
  );

  if (r.lt(1e-8)) {
    // the epsilon value has been discussed in #31286

    // vFrom and vTo point in opposite directions

    r = Decimal(0);

    if (Decimal.abs(vfx).gt(Decimal.abs(vfz))) {
      q.x = vfy.negated();
      q.y = vfx;
      q.z = Decimal(0);
      q.w = r;
    } else {
      q.x = Decimal(0);
      q.y = vfz.negated();
      q.z = vfy;
      q.w = r;
    }
  } else {
    // cross( vFrom, vTo )

    q.x = vfy.mul(vtz).sub(vfz.mul(vty));
    q.y = vfz.mul(vtx).sub(vfx.mul(vtz));
    q.z = vfx.mul(vty).sub(vfy.mul(vtx));
    q.w = r;
  }

  // normalize
  let l = Decimal.sum(q.x.pow(2), q.y.pow(2), q.z.pow(2), q.w.pow(2)).sqrt();

  if (l.eq(0)) {
    q.x = Decimal(0);
    q.y = Decimal(0);
    q.z = Decimal(0);
    q.w = Decimal(1);
  } else {
    q.x = q.x.div(l);
    q.y = q.y.div(l);
    q.z = q.z.div(l);
    q.w = q.w.div(l);
  }

  // console.log(
  //   "Q",
  //   "precise",
  //   Object.values(q).join(","),
  //   "original",
  //   Object.values(makeOriginalQuaternionFromVector3s(vFrom, vTo)).join(","),
  // );

  return q;
};

// ref https://github.com/mrdoob/three.js/blob/dev/src/math/Vector3.js#L467
/**
 * @param {import("three").Vector3} v
 * @param {PreciseQuaternion} q
 * @returns {import("three").Vector3}
 */
const applyPreciseQuaternionToVector3 = (v, q) => {
  // quaternion q is assumed to have unit length

  const vx = Decimal(v.x),
    vy = Decimal(v.y),
    vz = Decimal(v.z);

  const qx = q.x,
    qy = q.y,
    qz = q.z,
    qw = q.w;

  // t = 2 * cross( q.xyz, v );
  const tx = Decimal(2).mul(qy.mul(vz).sub(qz.mul(vy)));
  const ty = Decimal(2).mul(qz.mul(vx).sub(qx.mul(vz)));
  const tz = Decimal(2).mul(qx.mul(vy).sub(qy.mul(vx)));

  // // v + q.w * t + cross( q.xyz, t );
  // v.x = vx + qw * tx + qy * tz - qz * ty;
  // v.y = vy + qw * ty + qz * tx - qx * tz;
  // v.z = vz + qw * tz + qx * ty - qy * tx;

  // v + q.w * t + cross( q.xyz, t );
  v.x = vx.add(qw.mul(tx)).add(qy.mul(tz)).sub(qz.mul(ty)).toNumber();
  v.y = vy.add(qw.mul(ty)).add(qz.mul(tx)).sub(qx.mul(tz)).toNumber();
  v.z = vz.add(qw.mul(tz)).add(qx.mul(ty)).sub(qy.mul(tx)).toNumber();

  const vc = v.clone();
  applyOriginalQuaternionToVector3(vc, q);

  // console.log(
  //   "V",
  //   "precise",
  //   [v.x, v.y, v.z].join(","),
  //   "original",
  //   [vc.z, vc.y, vc.z].join(","),
  // );

  return v;
};

// original versions of quaternion math
// ref https://github.com/mrdoob/three.js/blob/dev/src/math/Quaternion.js#L471
const makeOriginalQuaternionFromVector3s = (vFrom, vTo) => {
  const q = {};

  // assumes direction vectors vFrom and vTo are normalized

  let r = vFrom.dot(vTo) + 1;

  if (r < 1e-8) {
    // the epsilon value has been discussed in #31286

    // vFrom and vTo point in opposite directions

    r = 0;

    if (Math.abs(vFrom.x) > Math.abs(vFrom.z)) {
      q.x = -vFrom.y;
      q.y = vFrom.x;
      q.z = 0;
      q.w = r;
    } else {
      q.x = 0;
      q.y = -vFrom.z;
      q.z = vFrom.y;
      q.w = r;
    }
  } else {
    // crossVectors( vFrom, vTo ); // inlined to avoid cyclic dependency on Vector3

    q.x = vFrom.y * vTo.z - vFrom.z * vTo.y;
    q.y = vFrom.z * vTo.x - vFrom.x * vTo.z;
    q.z = vFrom.x * vTo.y - vFrom.y * vTo.x;
    q.w = r;
  }

  // normalize
  let l = Math.sqrt(q.x * q.x + q.y * q.y + q.z * q.z + q.w * q.w);

  if (l === 0) {
    q.x = 0;
    q.y = 0;
    q.z = 0;
    q.w = 1;
  } else {
    l = 1 / l;

    q.x = q.x * l;
    q.y = q.y * l;
    q.z = q.z * l;
    q.w = q.w * l;
  }

  return q;
};

// ref https://github.com/mrdoob/three.js/blob/dev/src/math/Vector3.js#L467
const applyOriginalQuaternionToVector3 = (v, q) => {
  // quaternion q is assumed to have unit length

  const vx = v.x,
    vy = v.y,
    vz = v.z;

  const qx = q.x,
    qy = q.y,
    qz = q.z,
    qw = q.w;

  // t = 2 * cross( q.xyz, v );
  const tx = 2 * (qy * vz - qz * vy);
  const ty = 2 * (qz * vx - qx * vz);
  const tz = 2 * (qx * vy - qy * vx);

  // v + q.w * t + cross( q.xyz, t );
  v.x = vx + qw * tx + qy * tz - qz * ty;
  v.y = vy + qw * ty + qz * tx - qx * tz;
  v.z = vz + qw * tz + qx * ty - qy * tx;

  return v;
};
