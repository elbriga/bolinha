'use strict';

console.clear();

var sceneContainer = document.querySelector('.scene-container');
var scene = new THREE.Scene();
var cameraRoot = new THREE.Group();
var camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

var cameraOffset = new THREE.Group();
cameraOffset.position.z = -4;

cameraRoot.add(camera);
camera.add(cameraOffset);
scene.add(cameraRoot);

camera.position.y = 4;
camera.position.z = 60;

var renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);

sceneContainer.appendChild(renderer.domElement);

var groundGeometry = new THREE.PlaneGeometry(100, 100, 32, 32);
var ground = new THREE.Mesh(groundGeometry, new THREE.MeshBasicMaterial({color: 'rgb(255, 0, 0)'}));
ground.quaternion.setFromEuler(new THREE.Euler(-90 * (Math.PI / 180), 0, 0));
ground.position.y = -4;
scene.add(ground);

var collisionConfiguration = new Ammo.btDefaultCollisionConfiguration();
var collisionDispatcer = new Ammo.btCollisionDispatcher(collisionConfiguration);
var overlappingPairCache = new Ammo.btAxisSweep3(new Ammo.btVector3(-10, -10, -10), new Ammo.btVector3(10, 10, 10));
var solver = new Ammo.btSequentialImpulseConstraintSolver();
var world = new Ammo.btDiscreteDynamicsWorld(collisionDispatcer, overlappingPairCache, solver, collisionConfiguration);
world.setGravity(new Ammo.btVector3(0, -9.82, 0));

var groundShape = new Ammo.btStaticPlaneShape(new Ammo.btVector3(0, 1, 0), 0);
var groundTransform = new Ammo.btTransform();
groundTransform.setIdentity();
groundTransform.setOrigin(new Ammo.btVector3(0, -4, 0));

var groundRotation = new THREE.Quaternion();
groundTransform.setRotation(new Ammo.btQuaternion(groundRotation.x, groundRotation.y, groundRotation.z, groundRotation.w));

var groundMass = 0;
var groundInertia = new Ammo.btVector3(0, 0, 0);
groundShape.calculateLocalInertia(groundMass, groundInertia);
var motionState = new Ammo.btDefaultMotionState(groundTransform);
var groundRbInfo = new Ammo.btRigidBodyConstructionInfo(groundMass, motionState, groundShape, groundInertia);
var groundBody = new Ammo.btRigidBody(groundRbInfo);

groundBody.setContactProcessingThreshold(10000);
world.addRigidBody(groundBody);

class Box {
  
  constructor(halfExtents, origin, rotation, mass, inertia) {
    this._origin = origin;
    this._rotation = rotation;
    this._mass = mass;
    this._inertial = inertia;
    
    this.geometry = new THREE.BoxGeometry(halfExtents.x() * 2, halfExtents.y() * 2, halfExtents.z() * 2);
    this.material = new THREE.MeshBasicMaterial({color: 'rgb(0, 255, 0)'});
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    
    scene.add(this.mesh);
    
    this.shape = new Ammo.btBoxShape(halfExtents);
    this.shape.calculateLocalInertia(mass, inertia);

    this.transform = new Ammo.btTransform();
    
    this.transform.setIdentity();
    this.transform.setOrigin(origin);
    this.transform.setRotation(rotation);
    
    this.mass = mass;
    
    this.inertia = inertia;
    
    this.motionState = new Ammo.btDefaultMotionState(this.transform);
    this.rigidBodyInfo = new Ammo.btRigidBodyConstructionInfo(this.mass, this.motionState, this.shape, this.inertia)
    this.rigidBody = new Ammo.btRigidBody(this.rigidBodyInfo);
    
    this.rigidBody.setSleepingThresholds(0, 0);
    
    world.addRigidBody(this.rigidBody);
  }
  
  getTransform() {
    this.transform = this.rigidBody.getWorldTransform();
    let translation = this.transform.getOrigin();
    let rotation = this.transform.getRotation();
    
    return {
      translation: {x: translation.x(), y: translation.y(), z: translation.z()},
      rotation: {x: rotation.x(), y: rotation.y(), z: rotation.z(), w: rotation.w()}
    };
  }
  
  update(func) {
    
    if(!!func) {
      func();
    }
    
    let transform = this.getTransform();
    this.mesh.position.set(transform.translation.x, transform.translation.y, transform.translation.z);
    this.mesh.quaternion.set(transform.rotation.x, transform.rotation.y, transform.rotation.z, transform.rotation.w);
  }
  
  reset() {
    var transform = new Ammo.btTransform();
    transform.setIdentity();
    transform.setOrigin(this._origin);
    transform.setRotation(this._rotation);
    this.rigidBody.setLinearVelocity(new Ammo.btVector3(0, 0, 0));
    this.rigidBody.setAngularVelocity(new Ammo.btVector3(0, 0, 0));
    this.rigidBody.setWorldTransform(transform);
  }
}

var box01 = new Box(
  new Ammo.btVector3(3, .5, 1.5),
  new Ammo.btVector3(0, 10, 0),
  new Ammo.btVector4(0, 1, 0, 0),
  0.0,
  new Ammo.btVector3(0, 0, 0)
);

var box02 = new Box(
  new Ammo.btVector3(3, .5, 1.5),
  new Ammo.btVector3(8, 10, 0),
  new Ammo.btVector4(0, 1, 0, 0),
  10,
  new Ammo.btVector3(0, 0, 0)
);

var constraint = new Ammo.btHingeConstraint(
  box02.rigidBody,
  box01.rigidBody,
  new Ammo.btVector3(4, 0, 0),
  new Ammo.btVector3(-4, 0, 0),
  new Ammo.btVector3(0, 0, 1),
  new Ammo.btVector3(0, 0, 1),
  false
);

constraint.setLimit(0, Math.PI / 2);


world.addConstraint(constraint, false);

class Control {
  
  constructor() {
    this.isMousedown = false;
    this.isNav = false;
    this.currentX = 0;
    this.deltaX = 0;
    this.raycaster = window.r = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    
    this.lateral = [];
    this.longitudinal = [];

    window.addEventListener('keydown', function(e){

      if(e.keyCode == 37){
        if(this.lateral.indexOf('left') === -1){
          this.lateral.push('left');
        }

      }else if(e.keyCode == 38){
        if(this.longitudinal.indexOf('forward') === -1){
          this.longitudinal.push('forward');
        }

      }else if(e.keyCode == 39){
        if(this.lateral.indexOf('right') === -1){
          this.lateral.push('right');
        }

      }else if(e.keyCode == 40){
        if(this.longitudinal.indexOf('back') === -1){
          this.longitudinal.push('back');
        }
      }

    }.bind(this), false);

    window.addEventListener('keyup', function(e){

      if(e.keyCode == 37){
        this.lateral.splice(this.lateral.indexOf('left'), 1);

      }else if(e.keyCode == 38){
        this.longitudinal.splice(this.longitudinal.indexOf('forward'), 1);

      }else if(e.keyCode == 39){
        this.lateral.splice(this.lateral.indexOf('right'), 1);

      }else if(e.keyCode == 40){
        this.longitudinal.splice(this.longitudinal.indexOf('back'), 1);

      }
    }.bind(this), false);
        
    renderer.domElement.addEventListener('mousedown', (e) => {
      this.isMousedown = true;
      this.currentX = e.x;
    }, false);

    renderer.domElement.addEventListener('mouseup', (e) => this.isMousedown = false, false);
    
    renderer.domElement.addEventListener('mousemove', (e) => {
      this.mouse.x = (e.x / e.target.offsetWidth) * 2 - 1;
      this.mouse.y = ((e.y / e.target.offsetHeight) * 2 - 1) * -1;
            
      if(!this.isMousedown) {
        return;
      }
      this.deltaX = this.currentX - e.x;
            
      cameraRoot.rotation.y += this.deltaX * (Math.PI / 180);
      this.currentX = e.x;
    }, false);
  }
}

const CONTROL = new Control();

class Viewport {
  
  constructor() {
    
    this.isResizing = false;
    this.timeout;
    
    window.addEventListener('resize', this.onResize.bind(this));
  }
  
  onResize() {
    if(this.isResizing) {
      clearTimeout(this.timeout);
      this.timeout = this.onTimeout();
      return;
    }

    this.timeout = this.onTimeout();
    this.isResizing = true;
  }
  
  onTimeout() { 
    return setTimeout(() => {
      this.isResizing = false;
      renderer.setSize(window.innerWidth, window.innerHeight);
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
    }, 200);
  }
}

const VIEWPORT = new Viewport();

function lerp(a, b, x) {
    return  a * (1 - x) + b * x;
}

var initialTime = performance.now();
var currentTime;
var deltaTime;
var offsetTime = 0;

var box01Transform = new Ammo.btTransform();
box01Transform.setIdentity();

function tick(){
  currentTime = performance.now();
  deltaTime = (currentTime - initialTime) / 1000;
  offsetTime += deltaTime;
  initialTime = currentTime;
  
  world.stepSimulation(deltaTime);
  
  box01.update(function() {
    //Math.sin(freq * time) * amp
    
    //box01.rigidBody.activate();
    //box01Transform.setOrigin(new Ammo.btVector3(0, Math.sin(offsetTime * 2) * 10 + 10, 0));
    //box01.rigidBody.setWorldTransform(box01Transform);
  });
  box02.update();
  
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

tick();
