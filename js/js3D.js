if ( ! Detector.webgl )
	Detector.addGetWebGLMessage();

if ( ! Date.now )
	Date.now = function() { return new Date().getTime(); }

Ammo().then(function(Ammo) {
	
	
	
// Heightfield parameters
var terrainWidthExtents = 2000;
var terrainDepthExtents = 80;
var terrainWidth = 2000;
var terrainDepth = 80;
var terrainHalfWidth = terrainWidth / 2;
var terrainHalfDepth = terrainDepth / 2;
var terrainMaxHeight = -50;
var terrainMinHeight = -100;

var terrainMesh;

var heightData = null;
var ammoHeightData = null;
	
	
	
	var SCREEN_WIDTH = window.innerWidth;
	var SCREEN_HEIGHT = window.innerHeight;
	
	// "Defines"
	const ID_TETO = 1;
	const ID_BOLA = 2;
	
	// Geral
	const margin   = 0.05;
	const friction = 0.5;
	const forca_tiro = 100;
	
	// BOLA
	var bola;
	const bola_raio  = 24;
	const bola_massa = 30.0;
	const bola_posI  = -300;
	
	// LANÇA + CORDA = LAÇO
	var laco;
	var lanca;
	var corda;
	const lanca_raio = 5;
	const lanca_massa     = 5.0;
	const corda_massa     = 2;
	const corda_tamanho_inicial   = 120;
	const corda_segmentos_inicial = 10;
	
	// Teto e Blocos
	var teto;
	const totCubos = 11;
	const tamanhoGrid = 128;

	// Physics variables
	const gravityConstant = -9.8;
	var collisionConfiguration;
	var dispatcher;
	var broadphase;
	var solver;
	var softBodySolver;
	var physicsWorld;
	var rigidBodies = [];
	var transformAux1 = new Ammo.btTransform();
	var time = 0;
	
	var textureLoader;
	// Graphics variables
	var container, stats;
	var camera, controls, scene, renderer, composer;
	var directionalLight, pointLight;
	
	
	// Lava
	var uniforms;
	// Chao
	var terreno;
	
	// Controle do tamanho da corda
	var esticaCorda = 0;	

	
	var clock         = new THREE.Clock();
	var textureLoader = new THREE.TextureLoader();
	
	class obj3DT {
		constructor(mesh, shape, pos, mass, soft=false) {
			this._mesh  = mesh;
			this._shape = shape;
			this._pos   = pos;
			this._mass  = mass;
			this._soft  = soft;
			
			this.novo();
		}
		
		novo() {
			this._mesh.castShadow    = true;
			this._mesh.receiveShadow = true;
	
			var quat = new THREE.Quaternion();
			if ( this._soft ) {
				obj3DT.createSoftBody(  this._mesh, this._shape, this._mass, this._pos, quat );
			} else {
				this._shape.setMargin( margin );
				obj3DT.createRigidBody( this._mesh, this._shape, this._mass, this._pos, quat );
			}
			
			this.body.setFriction( friction );
		}
		
		get body() { return this._mesh.userData.physicsBody;	}
		get pos() { return this._mesh.position;	}
		get x() { return this._mesh.position.x;	}
		get y() { return this._mesh.position.y;	}
		get z() { return this._mesh.position.z;	}
		
		static createSoftBody( mesh, shape, mass, pos, quat ) {
			scene.add( mesh );
			
			var sbConfig = shape.get_m_cfg();
			sbConfig.set_viterations( 10 );
			sbConfig.set_piterations( 10 );
			shape.setTotalMass( mass, false );
			Ammo.castObject( shape, Ammo.btCollisionObject ).getCollisionShape().setMargin( margin * 3 );
			physicsWorld.addSoftBody( shape, 1, -1 );
			mesh.userData.physicsBody = shape;
			// Disable deactivation
			shape.setActivationState( 4 );
		}
		
		static createRigidBody( mesh, physicsShape, mass, pos, quat ) {
			mesh.position.copy( pos );
			mesh.quaternion.copy( quat );
			var transform = new Ammo.btTransform();
			transform.setIdentity();
			transform.setOrigin( new Ammo.btVector3( pos.x, pos.y, pos.z ) );
			transform.setRotation( new Ammo.btQuaternion( quat.x, quat.y, quat.z, quat.w ) );
			var motionState = new Ammo.btDefaultMotionState( transform );
			var localInertia = new Ammo.btVector3( 0, 0, 0 );
			physicsShape.calculateLocalInertia( mass, localInertia );
			var rbInfo = new Ammo.btRigidBodyConstructionInfo( mass, motionState, physicsShape, localInertia );
			var body = new Ammo.btRigidBody( rbInfo );
			mesh.userData.physicsBody = body;
			scene.add( mesh );
			if ( mass > 0 ) {
				rigidBodies.push( mesh );
				// Disable deactivation
				body.setActivationState( 4 );
			}
			physicsWorld.addRigidBody( body );
		}
		
		static removeRigidBody(body) {
			physicsWorld.removeRigidBody( body.userData.physicsBody );
			
			var index = rigidBodies.indexOf( body );
			if (index > -1) rigidBodies.splice(index, 1);
			scene.remove( body );
			
			delete body.userData.physicsBody;
			//body = null;
		}
		
		destruir () {
			obj3DT.removeRigidBody( this._mesh );
			this._mesh = null;
		}
		
		set mass(massa) {
			
			//var pBody = body.userData.physicsBody;

		    //console.log("mudar massa do objeto " + body + " para:" + mass);

		    //physicsWorld.removeRigidBody(body);

		    var inercia = new Ammo.btVector3( 0, 0, 0 );
		    this.body.getCollisionShape().calculateLocalInertia(massa, inercia);
		    this.body.setMassProps(massa, inercia);
		    
		    this.body.setLinearVelocity( new Ammo.btVector3( 0, 0, 0 ) );
		    this.body.setAngularVelocity( new Ammo.btVector3( 0, 0, 0 ) );

		    //physicsWorld.addRigidBody(body);
		}
		
		set posicao(novaPosicao) {
			// Remove e cria de novo
			obj3DT.removeRigidBody( this._mesh );
			
			this._pos = novaPosicao;
			this.novo();
		}
		
		grudar( on=true ) {
			if (on) {
				// Mudar a massa da lança para 0.0 para ela "grudar" no teto
				this._grudada = true;
				this.mass = 0.0;
				console.log('grude');
			} else {
				this._grudada = false;
				//changeMassObject(this._mesh, lanca_massa);
				this.mass = lanca_massa;
			}
		}
	}
	
	class bolaT extends obj3DT {
		constructor(raio, pos, material, massa) {
			var ballMesh  = new THREE.Mesh( new THREE.SphereBufferGeometry( raio, 32, 32 ), material );
			var ballShape = new Ammo.btSphereShape( raio );
			
			super(ballMesh, ballShape, pos, massa);
			this._raio  = raio;
		}
	}
	
	class lancaT extends bolaT {
		constructor(raio, pos, material) {
			super(raio, pos, material, lanca_massa);
			this._grudada = false;
		}
		
		destruir () {
			this.grudar( false );
			super.destruir();
		}
	}
	
	class cordaT extends obj3DT {
		constructor(posI, posF, segmentos) {
			// Grafico
			var corda_geo = new THREE.BufferGeometry();
			var corda_pontos  = [];
			var corda_indices = [];
			for ( var i = 0; i < segmentos + 1; i++ ) {
				corda_pontos.push( 0,0,0 );
			}
			for ( var i = 0; i < segmentos; i++ ) {
				corda_indices.push( i, i + 1 );
			}
			corda_geo.setIndex( new THREE.BufferAttribute( new Uint16Array( corda_indices ), 1 ) );
			corda_geo.addAttribute( 'position', new THREE.BufferAttribute( new Float32Array( corda_pontos ), 3 ) );
			corda_geo.computeBoundingSphere();
			
			var cordaMesh = new THREE.LineSegments( corda_geo, new THREE.LineBasicMaterial( { color: 0x0000ff } ) );
			
			// corda - physics
			var vertice      = new Ammo.btVector3(posI.x, posI.y, posI.z)
			var ropeSoftBody = new Ammo.btSoftBody(physicsWorld.getWorldInfo(), 1, vertice, [1.0]);
			for(var i=1; i <= segmentos; ++i) {
				// "lerp"
				var	porc = i / segmentos;
				vertice.setX((posF.x - posI.x) * porc + posI.x);
				vertice.setY((posF.y - posI.y) * porc + posI.y);
				vertice.setZ((posF.z - posI.z) * porc + posI.z);
				ropeSoftBody.appendNode( vertice, 1.0 );
			}
			for(var i=1; i <= segmentos; ++i) {
				ropeSoftBody.appendLink(i-1, i);
			}			
			
			super(cordaMesh, ropeSoftBody, posI, corda_massa, true);
			this.segmentos = segmentos;
			this.rls = 1.0;
			
			this._nos = [];
			var geometry = new THREE.SphereGeometry( 3, 16, 16 );
			var material = new THREE.MeshBasicMaterial( {color: 0xffff00} );
			for ( var i = 0; i < this.segmentos + 1; i++ ) {
				var sphere = new THREE.Mesh( geometry, material );
				this._nos[i] = sphere;
				scene.add( sphere );
			}
		}
		
		get posF() {
			var nos = this.body.get_m_nodes();
			var no  = nos.at(nos.size() - 1);
			var noPos = no.get_m_x();
			
			return new THREE.Vector3(noPos.x(), noPos.y(), noPos.z()); 
		}

		colar(obj1, obj2) {
			// "Colar" as pontas da corda nas bolinhas
			var influence = 1;
			this.body.get_m_anchors().clear();
			this.body.appendAnchor(              0, obj1.body, true, influence );
			this.body.appendAnchor( this.segmentos, obj2.body, true, influence );
		}
		
		enrolar(tamanho) {
			var nodes = this.body.get_m_nodes();
			var segmentLength = tamanho / this.segmentos;
			var ropePos = bola.pos.clone();
			ropePos.y += bola_raio;
			var v = nodes.at(0);
			v.set_m_x(new Ammo.btVector3(ropePos.x, ropePos.y, ropePos.z));
			for(var n=1; n<this.segmentos-1; n++) {
				var v = nodes.at(n);
				v.set_m_x(new Ammo.btVector3(ropePos.x + (n % 2 ? 0 : segmentLength), ropePos.y + 10, ropePos.z / 2));
			}
			var v = nodes.at(this.segmentos-1);
			v.set_m_x(new Ammo.btVector3(ropePos.x, ropePos.y + 20, 0));
		}
		
		aumentar() {
			if(this.rls < 4.0) this.rls += 0.01;
			this._shape.setRestLengthScale(this.rls);
		}
		diminuir() {
			if(this.rls > 0.2) this.rls -= 0.01;
			this._shape.setRestLengthScale(this.rls);
		}
		
		destruir () {
			for ( var i = 0; i < this.segmentos + 1; i++ )
				scene.remove( this._nos[i] );
			delete this._nos;
			this.body.get_m_anchors().clear();
			super.destruir();
		}
	}
	
	class lacoT {
		novoLaco (posF, segmentos=0) {
			// Lanca
			var poslanca = new THREE.Vector3(posF.x(), posF.y() + lanca_raio, 0);
			if (this._lanca) this._lanca.destruir();
			this._lanca = new lancaT(lanca_raio, poslanca, new THREE.MeshPhongMaterial( { color: 0xdddddd } ), lanca_massa);

			// corda
			this.novaCorda(segmentos);
		}
		
		novaCorda(segmentos=0) {
			var posI = new THREE.Vector3( bola.x, bola.y + bola_raio, bola.z );
			var posF = new THREE.Vector3( this._lanca.x, this._lanca.y - lanca_raio, 0 );
			
			if (this._corda) {
				if(segmentos <= 0)
					segmentos = this._corda.segmentos;
				this._corda.destruir();
			}
			
			this._corda = new cordaT(posI, posF, segmentos);
			
			this.colar();
		}
		
		colar() {
			this._corda.colar(bola, this._lanca);
		}
		
		lancar (tamanho, direcao, forca) {
			var ropeEnd = new Ammo.btVector3( bola.x, bola.y + bola_raio + 20, 0 );
			this.novoLaco(ropeEnd, corda_segmentos_inicial);
			
			this._corda.enrolar(tamanho);
			
			var tiroVect = direcao.multiplyScalar( forca );
			direcao.y = 0 - direcao.y;
			this._lanca.body.setLinearVelocity( new Ammo.btVector3( tiroVect.x, tiroVect.y , 0 ) );
		}
		
		get grudado() {
			return this._lanca._grudada;
		}
		
		_delay() {
			var agora = Date.now();
			if (!this._tsdelay) this._tsdelay = 0;
			if (agora > this._tsdelay) {
				this._tsdelay = agora + 500;
				return false;
			}
			return true;
		}
		
		aumentar() {
			//if (this._delay()) return;
			console.log('laco.aumentar()');
			
			this._corda.aumentar();
		}
		diminuir() {
			//if (this._delay()) return;
			console.log('laco.diminuir()');
			
			this._corda.diminuir();
		}
		
		grudar( on=true ) {
			if(this.grudado) return;
			
			var ropeEnd = new Ammo.btVector3( this._lanca.x, this._lanca.y - lanca_raio, 0 );
			this.novoLaco(ropeEnd);
			
			this._lanca.grudar(on);
		}
	}

	
	
	
	
	
	
	function initPhysics() {
		// Physics configuration
		collisionConfiguration = new Ammo.btSoftBodyRigidBodyCollisionConfiguration();
		dispatcher             = new Ammo.btCollisionDispatcher( collisionConfiguration );
		
		broadphase = new Ammo.btDbvtBroadphase();
		
		solver         = new Ammo.btSequentialImpulseConstraintSolver();
		softBodySolver = new Ammo.btDefaultSoftBodySolver();
		
		physicsWorld = new Ammo.btSoftRigidDynamicsWorld( dispatcher, broadphase, solver, collisionConfiguration, softBodySolver);
		
		physicsWorld.setGravity( new Ammo.btVector3( 0, gravityConstant, 0 ) );
		physicsWorld.getWorldInfo().set_m_gravity( new Ammo.btVector3( 0, gravityConstant, 0 ) );
	}
	
	
	
	
	
	
	
	


	function initScene() {
		camera = new THREE.PerspectiveCamera( 36, window.innerWidth / window.innerHeight, 1, 2000 );
		scene  = new THREE.Scene();
		
		camera.position.x = 0;
		camera.position.y = tamanhoGrid / 2;
		camera.position.z = 500;
		
		alvoCamera = new THREE.Vector3( 0, 0, 0 );
		camera.lookAt( alvoCamera );

		
		
		scene.background = new THREE.Color( 0xf0f0f0 );

		var ambientLight = new THREE.AmbientLight( 0xcccccc, 0.4 );
		scene.add( ambientLight );

		var pointLight = new THREE.PointLight( 0xffffff, 0.8 );
		camera.add( pointLight );
		scene.add( camera );
		
		// Lava
		uniforms = {
				//fogDensity: { value: 0.45 },
				//fogColor: { value: new THREE.Vector3( 0, 0, 0 ) },
				time: { value: 1.0 },
				uvScale: { value: new THREE.Vector2( 3.0, 1.0 ) },
				texture1: { value: textureLoader.load( 'textures/lava/cloud.png' ) },
				texture2: { value: textureLoader.load( 'textures/lava/lavatile.jpg' ) }
			};
		uniforms.texture1.value.wrapS = uniforms.texture1.value.wrapT = THREE.RepeatWrapping;
		uniforms.texture2.value.wrapS = uniforms.texture2.value.wrapT = THREE.RepeatWrapping;
	}
	
	
	
	
	function createParalellepiped( sx, sy, sz, mass, pos, quat, material, solido=true ) {
		var threeObject = new THREE.Mesh( new THREE.BoxBufferGeometry( sx, sy, sz, 1, 1, 1 ), material );
		if(solido) {
			var shape = new Ammo.btBoxShape( new Ammo.btVector3( sx * 0.5, sy * 0.5, sz * 0.5 ) );
			shape.setMargin( margin );
			obj3DT.createRigidBody( threeObject, shape, mass, pos, quat );
		} else {
			threeObject.position.copy( pos );
			scene.add( threeObject );
		}
		return threeObject;
	}
	
	
function generateHeight( width, depth, minHeight, maxHeight ) {
	// Generates the height data (a sinus wave)
	var size = width * depth;
	var data = new Float32Array(size);

	var hRange = maxHeight - minHeight;
	var w2 = width / 2;
	var d2 = depth / 2;
	var phaseMult = 12;

	var p = 0;
	for ( var j = 0; j < depth; j++ ) {
		for ( var i = 0; i < width; i++ ) {
			var radius = Math.sqrt(
					Math.pow( ( i - w2 ) / w2, 2.0 ) +
					Math.pow( ( j - d2 ) / d2, 2.0 ) );
			var height = ( Math.sin( radius * phaseMult ) + 1 ) * 0.5 * hRange + minHeight;
			
			//var height = (j<3 || j>depth-3 || i<3 || i>width-3) ? 3 : 0;
			data[ p ] = height;
			p++;
		}
	}

	return data;
}

function createTerrainShape() {
	// This parameter is not really used, since we are using PHY_FLOAT height data type and hence it is ignored
	var heightScale = 1;

	// Up axis = 0 for X, 1 for Y, 2 for Z. Normally 1 = Y is used.
	var upAxis = 1;

	// hdt, height data type. "PHY_FLOAT" is used. Possible values are "PHY_FLOAT", "PHY_UCHAR", "PHY_SHORT"
	var hdt = "PHY_FLOAT";

	// Set this to your needs (inverts the triangles)
	var flipQuadEdges = false;

	// Creates height data buffer in Ammo heap
	ammoHeightData = Ammo._malloc(4 * terrainWidth * terrainDepth);

	// Copy the javascript height data array to the Ammo one.
	var p = 0;
	var p2 = 0;
	for ( var j = 0; j < terrainDepth; j++ ) {
		for ( var i = 0; i < terrainWidth; i++ ) {
			// write 32-bit float data to memory
			Ammo.HEAPF32[ (ammoHeightData + p2) >> 2 ] = heightData[ p ];
			p++;

			// 4 bytes/float
			p2 += 4;
		}
	}

	// Creates the heightfield physics shape
	var heightFieldShape = new Ammo.btHeightfieldTerrainShape(
			terrainWidth,
			terrainDepth,
			ammoHeightData,
			heightScale,
			terrainMinHeight,
			terrainMaxHeight,
			upAxis,
			hdt,
			flipQuadEdges
		);

	// Set horizontal scale
	/*var scaleX = terrainWidthExtents / ( terrainWidth - 1 );
	var scaleZ = terrainDepthExtents / ( terrainDepth - 1 );
	heightFieldShape.setLocalScaling( new Ammo.btVector3( scaleX, 1, scaleZ ) );*/
	heightFieldShape.setMargin( 0.05 );

	return heightFieldShape;
}
	
	
	function initObjs() {
		var pos  = new THREE.Vector3();
		var quat = new THREE.Quaternion();
		
//heightData = generateHeight( terrainWidth, terrainDepth, terrainMinHeight, terrainMaxHeight );

// Terreno
var geometry = new THREE.PlaneBufferGeometry( terrainWidthExtents, terrainDepthExtents, terrainWidth - 1, terrainDepth - 1 );
geometry.rotateX( -Math.PI / 2 );

var vertices = geometry.attributes.position.array;
for ( var i = 0, j = 0, l = vertices.length; i < l; i++, j += 3 ) {
	// j + 1 because it is the y component that we modify
	vertices[ j + 1 ] = heightData[ i ];

}

geometry.computeVertexNormals();

var groundMaterial = new THREE.MeshPhongMaterial( { color: 0xC7C7C7 } );
terrainMesh = new THREE.Mesh( geometry, groundMaterial );
terrainMesh.receiveShadow = true;
terrainMesh.castShadow = true;

scene.add( terrainMesh );

textureLoader.load("textures/grid.png", function ( texture ) {
	texture.wrapS = THREE.RepeatWrapping;
	texture.wrapT = THREE.RepeatWrapping;
	texture.repeat.set( terrainWidth - 1, terrainDepth - 1 );
	groundMaterial.map = texture;
	groundMaterial.needsUpdate = true;

});

var groundShape = createTerrainShape();
var groundTransform = new Ammo.btTransform();
groundTransform.setIdentity();
// Shifts the terrain, since bullet re-centers it on its bounding box.
groundTransform.setOrigin( new Ammo.btVector3( 0, ( terrainMaxHeight + terrainMinHeight ) / 2, 0 ) );
var groundMass = 0;
var groundLocalInertia = new Ammo.btVector3( 0, 0, 0 );
var groundMotionState = new Ammo.btDefaultMotionState( groundTransform );
var groundBody = new Ammo.btRigidBody( new Ammo.btRigidBodyConstructionInfo( groundMass, groundMotionState, groundShape, groundLocalInertia ) );
physicsWorld.addRigidBody( groundBody );
		
		// Lava
		var materialLava = new THREE.ShaderMaterial( {
				uniforms: uniforms,
				vertexShader: document.getElementById( 'vertexShaderLava' ).textContent,
				fragmentShader: document.getElementById( 'fragmentShaderLava' ).textContent
			});
		pos.set( 0,-tamanhoGrid-20,0 );
		quat.set( 0, 0, 0, 1 );
		var chao = createParalellepiped( 8192, 100, 200, 0, pos, quat, materialLava, false );
		chao.castShadow = true;
		chao.receiveShadow = true;
		
		
		
		
		var cubosDeCadaLado = ((totCubos-1) / 2);

		var map = textureLoader.load( 'textures/UV_Grid_Sm.jpg' );
		map.wrapS = map.wrapT = THREE.RepeatWrapping;
		map.anisotropy = 16;
		var material = new THREE.MeshPhongMaterial( { map: map, side: THREE.DoubleSide } );

		// BOLA
		pos.set( bola_posI, 0, 0 );
		bola = new bolaT( bola_raio, pos, material, bola_massa);

		// Teto
		pos.set( 0,tamanhoGrid,0 );
		quat.set( 0, 0, 0, 1 );
		teto = createParalellepiped( totCubos * tamanhoGrid, 4, 100, 0, pos, quat, material );
		teto.castShadow = true;
		teto.receiveShadow = true;
		teto.userData.physicsBody.setUserIndex(ID_TETO);
		
		// Laço
		laco = new lacoT();
		var ropeEnd = new Ammo.btVector3( bola.x, bola.y + bola_raio + corda_tamanho_inicial, 0 );
		laco.novoLaco(ropeEnd, corda_segmentos_inicial);
//lanca.userData.physicsBody.setLinearVelocity( new Ammo.btVector3( 250, 250, 0 ) );
		
		
		/*var geometryCyl = new THREE.CylinderGeometry( tamanhoGrid, tamanhoGrid, tamanhoGrid, 32, 32, true, 0, Math.PI  );
		geometryCyl.scale(0.33, 1, 1);
		var materialCyl = new THREE.MeshBasicMaterial( {color: 0x999999} );*/
		
		/*/ GRID Cubos(100x100x100)
		var geometryCube = new THREE.EdgesGeometry( new THREE.BoxBufferGeometry( tamanhoGrid, tamanhoGrid, tamanhoGrid ) );
		
		for(var c=-cubosDeCadaLado; c<=cubosDeCadaLado; c++) {
			// "chao"
			var cube = new THREE.LineSegments(
					geometryCube,
					new THREE.LineDashedMaterial( { color: 0xffaa00 + c*16, dashSize: 3, gapSize: 2, linewidth: 3 } )
				);
			cube.receiveShadow = true;
			cube.position.set( c * tamanhoGrid, -(tamanhoGrid / 2), 0 );
			scene.add( cube );
			
			
			
			/*var cylinder = new THREE.Mesh( geometryCyl, materialCyl );
			cylinder.rotation.z = Math.PI/2;
			cylinder.receiveShadow = true;
			cylinder.position.set( c * tamanhoGrid, -tamanhoGrid, 0 );
			scene.add( cylinder );/
			
			// "teto"
			cube = new THREE.LineSegments(
					geometryCube,
					new THREE.LineDashedMaterial( { color: 0xffaa00 - c*16, dashSize: 30, gapSize: 10, linewidth: 3 } )
				);
			cube.receiveShadow = true;
			cube.position.set( c * tamanhoGrid, tamanhoGrid / 2, 0 );
			scene.add( cube );
		}*/
	}
	
	function initRenderer() {
		renderer = new THREE.WebGLRenderer( { antialias: true } );
		renderer.shadowMap.enabled = true;
		renderer.setPixelRatio( window.devicePixelRatio );
		renderer.setSize( window.innerWidth, window.innerHeight );
		document.body.appendChild( renderer.domElement );
		renderer.autoClear = false;
		
		var renderModel = new THREE.RenderPass( scene, camera );
		var effectBloom = new THREE.BloomPass( 1.25 );
		var effectFilm = new THREE.FilmPass( 0.35, 0.95, 2048, false );
		
		effectFilm.renderToScreen = true;
		
		composer = new THREE.EffectComposer( renderer );
		
		composer.addPass( renderModel );
		composer.addPass( effectBloom );
		composer.addPass( effectFilm );

		window.addEventListener('resize', onWindowResize, false );

		stats = new Stats();
		document.body.appendChild( stats.dom );
	}
	
	
	
	
	


	function onWindowResize() {
		SCREEN_WIDTH = window.innerWidth;
		SCREEN_HEIGHT = window.innerHeight;

		renderer.setSize( SCREEN_WIDTH, SCREEN_HEIGHT );

		camera.aspect = SCREEN_WIDTH / SCREEN_HEIGHT;
		camera.updateProjectionMatrix();
		
		//composer.reset();
	}
	
	function deteremineScreenCoordinate(object) {
        var vector = new THREE.Vector3();
        vector.setFromMatrixPosition(object.matrixWorld);
        vector.project(camera);
        var width = window.innerWidth, height = window.innerHeight;
        var widthHalf = width / 2, heightHalf = height / 2;
        vector.x = ( vector.x * widthHalf ) + widthHalf;
        vector.y = -( vector.y * heightHalf ) + heightHalf;
        return vector;
    }

	function initInput() {
		window.addEventListener( 'keydown', function( event ) {
			switch ( event.keyCode ) {
				case 81: // Q
					esticaCorda = -1;
				break;
				
				case 65: // A
					esticaCorda =  1;
				break;
			}
		}, false );
		
		window.addEventListener( 'keyup', function( event ) {
			esticaCorda = 0;
		}, false );
		
		
		window.addEventListener( 'mousedown', function( event ) {
			var tamanhoLaco = 250;
			//var raycaster = new THREE.Raycaster();
			
			
			
			var posBolaTela = deteremineScreenCoordinate(bola._mesh);
			console.log("px:" + event.clientX + " - pY:" + event.clientY);
			console.log("bolx:" + posBolaTela.x + " - boly:" + posBolaTela.y );
			
			var dir = new THREE.Vector3(
					event.clientX - posBolaTela.x,
					event.clientY - posBolaTela.y,
					0
				).normalize();
			
			
			/*var mouseCoords = new THREE.Vector2();
			mouseCoords.set(
				( event.clientX / window.innerWidth ) * 2 - 1,
				- ( event.clientY / window.innerHeight ) * 2 + 1
			);
			
			console.log("bolx:" + bola.x + " - boly:" + bola.y );
			console.log("mcx2:" + mouseCoords.x + " - mcy2:" + mouseCoords.y );
			
			
			/*raycaster.setFromCamera( mouseCoords, camera );
			
			// See if the ray from the camera into the world hits one of our meshes
			var intersects = raycaster.intersectObject( teto );
			// Toggle rotation bool for meshes that we clicked
			if ( intersects.length > 0 ) {
				/*helper.position.set( 0, 0, 0 );
				helper.lookAt( intersects[ 0 ].face.normal );
				helper.position.copy( intersects[ 0 ].point );*
				
				
				
				var cat1 = (intersects[0].point.x - bola.x);
				var cat2 = ((intersects[0].point.y-lanca_raio) - (bola.y+bola_raio));
				tamanhoLaco = Math.sqrt( (cat1 * cat1) + (cat2 * cat2) );
				
				console.log("hipo:" + tamanhoLaco );
			}*/
			
			/*/ Creates a ball and throws it
			var ballMass = 35;
			var ballRadius = 0.4;
			var ball = new THREE.Mesh( new THREE.SphereBufferGeometry( ballRadius, 14, 10 ), ballMaterial );
			ball.castShadow = true;
			ball.receiveShadow = true;
			var ballShape = new Ammo.btSphereShape( ballRadius );
			ballShape.setMargin( margin );
			
			pos.copy( raycaster.ray.direction );
			pos.add( raycaster.ray.origin );
			quat.set( 0, 0, 0, 1 );
			var ballBody = obj3DT.createRigidBody( ball, ballShape, ballMass, pos, quat );
			
			pos.copy( raycaster.ray.direction );
			pos.multiplyScalar( 24 );
			ballBody.setLinearVelocity( new Ammo.btVector3( pos.x, pos.y, pos.z ) );*/
			
					
			
			
			laco.lancar(tamanhoLaco, dir, forca_tiro);
			
			
			/*
			var msLanca = lanca.userData.physicsBody.getMotionState();
			msLanca.getWorldTransform( transformAux1 );
			
			var rePos = bola.mesh.position.clone();
			rePos.y += 50;
			
			transformAux1.setOrigin(new THREE.Vector3( rePos.x, rePos.y, 0) );  // or whatever
			
			msLanca.setWorldTransform(transformAux1);
			//lanca.userData.physicsBody.setCenterOfMassTransform(transformAux1);
		    
		    lanca.position.set( rePos.x, rePos.y, 0 );*/
			
		}, false );
	}
	

	function animate() {
		render();
		stats.update();

		requestAnimationFrame( animate );
	}

	function render() {
		var deltaTime = clock.getDelta();
		var timer = Date.now() * 0.0001;
		
		
		updatePhysics( deltaTime );
/*		scene.traverse( function( object ) {
				if ( object.castShadow ) {
				}
			} );*/
		
		// Lava
		uniforms.time.value += (deltaTime * 2);
		
		camera.position.x = bola.x - bola_posI;
		renderer.render( scene, camera );
		//renderer.clear();
		//composer.render( 0.01 );

		time += deltaTime;
	}
	
	function updatePhysics( deltaTime ) {
		// Esticar ou encolher a corda?
		if( esticaCorda ==  1 ) laco.aumentar();
		if( esticaCorda == -1 ) laco.diminuir();	
		
		// Step world
		physicsWorld.stepSimulation( deltaTime * 16, 2, 1/30 );
		
		// Colisoes
		if(!laco.grudado) {
			for(var col=0; col<dispatcher.getNumManifolds(); col++) {
				var colisao = dispatcher.getManifoldByIndexInternal(col);
				var obj1 = colisao.getBody0();
				var obj2 = colisao.getBody1();
				
				var id1 = obj1.getUserIndex();
				var id2 = obj2.getUserIndex();
				
				// Verificar por colisoes da Lança com o Teto
				if(id1 == ID_TETO && id2 == 0) {
					laco.grudar();
				}
			}
		}
		
		// Atualizar corda
		//if(corda) {
			var softBody = laco._corda.body;
			var ropePositions = laco._corda._mesh.geometry.attributes.position.array;
			var numVerts = ropePositions.length / 3;
			var nodes = softBody.get_m_nodes();
			var indexFloat = 0;
			for ( var i = 0; i < numVerts; i ++ ) {
				var node = nodes.at( i );
				var nodePos = node.get_m_x();
				ropePositions[ indexFloat++ ] = nodePos.x();
				ropePositions[ indexFloat++ ] = nodePos.y();
				ropePositions[ indexFloat++ ] = nodePos.z();
				
				var no = laco._corda._nos[i];
				no.position.set(nodePos.x(),nodePos.y(),nodePos.z());
			}
			laco._corda._mesh.geometry.attributes.position.needsUpdate = true;
		//}
		
		// Update rigid bodies
		for ( var i = 0, il = rigidBodies.length; i < il; i++ ) {
			var objThree = rigidBodies[ i ];
			var objPhys = objThree.userData.physicsBody;
			var ms = objPhys.getMotionState();
			if ( ms ) {
				ms.getWorldTransform( transformAux1 );
				var p = transformAux1.getOrigin();
				var q = transformAux1.getRotation();
				objThree.position.set( p.x(), p.y(), p.z() );
				objThree.quaternion.set( q.x(), q.y(), q.z(), q.w() );
			}
		}
	}
	
	function initDebug() {
		setInterval(function(){
				var v = deteremineScreenCoordinate(bola._mesh);
				console.log(v.x + " " + v.y + " " + v.z);
			}, 1000);
	}
	
	function init() {
		initPhysics();
		initScene();
		initObjs();
		initRenderer();
		initInput();
		
		//initDebug();
		
		animate();
	}

	textureLoader.load( "assets/fases/fase02.png", function ( texture ) {
			    //var canvas = document.createElement("canvas");
				var canvas = document.getElementById("canvas");
			    canvas.width  = texture.image.naturalWidth;
			    canvas.height = texture.image.naturalHeight;
			    // Copy the image contents to the canvas
			    var ctx = canvas.getContext("2d");
			    ctx.drawImage(texture.image, 0, 0);

			    var data8 = ctx.getImageData(0,0,canvas.width,canvas.height).data;
			    
			    var size = terrainWidth * terrainDepth;
			    heightData = new Float32Array(size);
			    
			    var p = 0;
			    var p2 = 0;
			    for ( var j = 0; j < terrainDepth; j++ ) {
					for ( var i = 0; i < terrainWidth; i++ ) {
						var Y = Math.floor((j / (terrainDepth-1)) * canvas.height);
						var X = Math.floor((i / (terrainWidth-1)) * canvas.width);
						
						p2 = (Y << 2) * canvas.width + (X << 2);
						heightData[p] = (i==0||j==0||i==terrainWidth-1||j==terrainDepth-1) ? -100 : ((255-data8[p2]) / 5.1) - 100;
						p++;
					}
			    }
			    
			    init();
			}
		);
});

