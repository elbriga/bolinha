Ammo().then(function(Ammo) {
	if ( ! Detector.webgl ) Detector.addGetWebGLMessage();
	
	// Geral
	const margin   = 0.05;
	const friction = 0.5;
	const forca_tiro = 100;
	
	// BOLA
	var bola;
	const bola_raio  = 24;
	const bola_massa = 30;
	const bola_posI  = -300;
	
	// LANÇA + CORDA = LAÇO
	var laco;
	var lanca;
	var corda;
	const lanca_raio = 5;
	const lanca_massa     = 10.0;
	const corda_massa     = 2;
	const corda_tamanho   = 120;
	const corda_segmentos = 10;
	
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
	
	
	
	
	// Graphics variables
	var container, stats;
	var camera, controls, scene, renderer, stats;
	var textureLoader;
	
	var clock = new THREE.Clock();
	
	class obj3DT {
		constructor(mesh, shape, pos, mass, soft=false) {
			this._mesh  = mesh;
			this._shape = shape;
			this._pos   = pos;
			this._mass  = mass;
			this._soft  = soft;
			
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
		
		destruir () {
			removeRigidBody( this._mesh );
			this._mesh = null;
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
		
		grudar( on=true ) {
			if (on) {
				// Mudar a massa da lança para 0.0 para ela "grudar" no teto
				this._grudada = true;
				changeMassObject(this._mesh, 0.0);
			} else {
				this._grudada = false;
				changeMassObject(this._mesh, lanca_massa);
			}
		}
		
		destruir () {
			this.grudar( false );
			super.destruir();
		}
	}
	
	class cordaT extends obj3DT {
		constructor(tamanho, posI, posF) {
			// Grafico
			var corda_geo = new THREE.BufferGeometry();
			var corda_pontos  = [];
			var corda_indices = [];
			for ( var i = 0; i < corda_segmentos + 1; i++ ) {
				corda_pontos.push( 0,0,0 );
			}
			for ( var i = 0; i < corda_segmentos; i++ ) {
				corda_indices.push( i, i + 1 );
			}
			corda_geo.setIndex( new THREE.BufferAttribute( new Uint16Array( corda_indices ), 1 ) );
			corda_geo.addAttribute( 'position', new THREE.BufferAttribute( new Float32Array( corda_pontos ), 3 ) );
			corda_geo.computeBoundingSphere();
			
			var cordaMesh = new THREE.LineSegments( corda_geo, new THREE.LineBasicMaterial( { color: 0x000000 } ) );
			
			// corda - physics
			var ropePos = bola.pos.clone();
			ropePos.y += bola_raio;
			
			var softBodyHelpers = new Ammo.btSoftBodyHelpers();
			var ropeSoftBody = softBodyHelpers.CreateRope( physicsWorld.getWorldInfo(), posI, posF, corda_segmentos - 1, 0 );
			
			
			super(cordaMesh, ropeSoftBody, posI, corda_massa, true);
			this._tamanho = tamanho;
			this._posI    = posI;
			this._posF    = posF;
		}
		
		destruir () {
			this.body.get_m_anchors().clear();
			super.destruir();
		}
	}
	
	class lacoT {
		novoLaco (posF, tamanho) {
			this._posI = new Ammo.btVector3( bola.x, bola.y + bola_raio, 0 );
			this._posF = posF;
			this._tamanho = tamanho;
			
			if (this._lanca) this._lanca.destruir();
			if (this._corda) this._corda.destruir();

			// Lanca
			var poslanca = new THREE.Vector3(posF.x(), posF.y() + lanca_raio, 0);
			this._lanca = new lancaT(lanca_raio, poslanca, new THREE.MeshPhongMaterial( { color: 0xdddddd } ), lanca_massa);

			// corda
			this._corda = new cordaT(tamanho, this._posI, this._posF);
			
			// "Colar" as pontas da corda nas bolinhas
			var influence = 1;
			this._corda.body.appendAnchor( 0, bola.body, true, influence );
			this._corda.body.appendAnchor( corda_segmentos, this._lanca.body, true, influence );
		}
		
		lancar (tamanho, direcao, forca) {
			var ropeEnd = new Ammo.btVector3( bola.x, bola.y + bola_raio + 20, 0 );
			this.novoLaco(ropeEnd, corda_tamanho);
			
			// "Enrolar" a corda!
			var nodes = this._corda.body.get_m_nodes();
			var segmentLength = corda_tamanho / corda_segmentos;
			var ropePos = bola.pos.clone();
			ropePos.y += bola_raio;
			var v = nodes.at(0);
			v.set_m_x(new Ammo.btVector3(ropePos.x, ropePos.y, 0));
			for(var n=1; n<10; n++) {
				var v = nodes.at(n);
				v.set_m_x(new Ammo.btVector3(ropePos.x + (n % 2 ? 0 : segmentLength), ropePos.y + 10, 0));
			}
			var v = nodes.at(10);
			v.set_m_x(new Ammo.btVector3(ropePos.x, ropePos.y + 20, 0));
			
			var tiroVect = direcao.multiplyScalar( forca );
			direcao.y = 0 - direcao.y;
			this._lanca.body.setLinearVelocity( new Ammo.btVector3( tiroVect.x, tiroVect.y , 0 ) );
		}
		
		get grudado() {
			return this._lanca._grudada;
		}
	}
	
	function initPhysics() {
		// Physics configuration
		collisionConfiguration = new Ammo.btSoftBodyRigidBodyCollisionConfiguration();
		dispatcher = new Ammo.btCollisionDispatcher( collisionConfiguration );
		broadphase = new Ammo.btDbvtBroadphase();
		solver = new Ammo.btSequentialImpulseConstraintSolver();
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
	}
	
	function initObjs() {
		var pos  = new THREE.Vector3();
		var quat = new THREE.Quaternion();
		
		var cubosDeCadaLado = ((totCubos-1) / 2);

		var map = new THREE.TextureLoader().load( 'textures/UV_Grid_Sm.jpg' );
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
		
		// Lança
		laco = new lacoT();
		var ropeEnd = new Ammo.btVector3( bola.x, bola.y + bola_raio + corda_tamanho, 0 );
		laco.novoLaco(ropeEnd, corda_tamanho);
//lanca.userData.physicsBody.setLinearVelocity( new Ammo.btVector3( 250, 250, 0 ) );
		
		
		var geometryCyl = new THREE.CylinderGeometry( tamanhoGrid, tamanhoGrid, tamanhoGrid, 32, 32, true, 0, Math.PI  );
		geometryCyl.scale(0.33, 1, 1);
		var materialCyl = new THREE.MeshBasicMaterial( {color: 0x999999} );
		
		// GRID Cubos(100x100x100)
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
			
			
			
			var cylinder = new THREE.Mesh( geometryCyl, materialCyl );
			cylinder.rotation.z = Math.PI/2;
			cylinder.receiveShadow = true;
			cylinder.position.set( c * tamanhoGrid, -tamanhoGrid, 0 );
			scene.add( cylinder );
			
			// "teto"
			cube = new THREE.LineSegments(
					geometryCube,
					new THREE.LineDashedMaterial( { color: 0xffaa00 - c*16, dashSize: 30, gapSize: 10, linewidth: 3 } )
				);
			cube.receiveShadow = true;
			cube.position.set( c * tamanhoGrid, tamanhoGrid / 2, 0 );
			scene.add( cube );
		}

		/*// CHAO
		var ground = new THREE.Mesh(
				new THREE.PlaneBufferGeometry( 400, 400, 1, 1 ),
				new THREE.MeshPhongMaterial( { color: 0xa0adaf, shininess: 150, side: THREE.DoubleSide } )
			);
		ground.rotation.x = -0.98 * Math.PI / 2; // rotates X/Y to X/Z
		ground.receiveShadow = true;
		scene.add( ground );*/

		renderer = new THREE.WebGLRenderer( { antialias: true } );
		renderer.shadowMap.enabled = true;
		renderer.setPixelRatio( window.devicePixelRatio );
		renderer.setSize( window.innerWidth, window.innerHeight );
		window.addEventListener( 'resize', onWindowResize, false );
		document.body.appendChild( renderer.domElement );

		stats = new Stats();
		document.body.appendChild( stats.dom );

		//

		

	}
	
	function createParalellepiped( sx, sy, sz, mass, pos, quat, material ) {
		var threeObject = new THREE.Mesh( new THREE.BoxBufferGeometry( sx, sy, sz, 1, 1, 1 ), material );
		var shape = new Ammo.btBoxShape( new Ammo.btVector3( sx * 0.5, sy * 0.5, sz * 0.5 ) );
		shape.setMargin( margin );
		obj3DT.createRigidBody( threeObject, shape, mass, pos, quat );
		return threeObject;
	}
	
	function removeRigidBody(body) {
		physicsWorld.removeRigidBody( body.userData.physicsBody );
		
		var index = rigidBodies.indexOf( body );
		if (index > -1) rigidBodies.splice(index, 1);
		scene.remove( body );
		
		delete body.userData.physicsBody;
		body = null;
	}
	
	function changeMassObject(body, mass) {
		var pBody = body.userData.physicsBody;

	    //console.log("mudar massa do objeto " + body + " para:" + mass);

	    //physicsWorld.removeRigidBody(body);

	    var inertia = new Ammo.btVector3( 0, 0, 0 );
	    pBody.getCollisionShape().calculateLocalInertia(mass, inertia);
	    pBody.setMassProps(mass, inertia);
	    
	    pBody.setLinearVelocity( new Ammo.btVector3( 0, 0, 0 ) );
	    pBody.setAngularVelocity( new Ammo.btVector3( 0, 0, 0 ) );

	    //physicsWorld.addRigidBody(body);
	}

	function onWindowResize() {

		camera.aspect = window.innerWidth / window.innerHeight;
		camera.updateProjectionMatrix();

		renderer.setSize( window.innerWidth, window.innerHeight );

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
		window.addEventListener( 'mousedown', function( event ) {
			var tamanhoLaco = 500;
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

		requestAnimationFrame( animate );

		render();
		stats.update();

	}

	function render() {
		var timer = Date.now() * 0.0001;
		
		/*bola.mesh.position.set( -raioBolinha / 2, 0, 0 );
		bola.mesh.rotation.x = timer * 5;
		bola.mesh.rotation.y = timer * 2.5;*/
		
		var deltaTime = clock.getDelta();
		
		updatePhysics( deltaTime );

/*				scene.traverse( function( object ) {

					if ( object.castShadow ) {
					
						bola = object;
						
						object.position.set( -200, 0, 0 );

						object.rotation.x = timer * 5;
						object.rotation.y = timer * 2.5;

					}

				} );*/

		camera.position.x = bola.x - bola_posI;
		renderer.render( scene, camera );
		
		time += deltaTime;
	}
	
	function updatePhysics( deltaTime ) {
		// Step world
		physicsWorld.stepSimulation( deltaTime * 10, 2, 1/30 );
		
		// Colisoes
		if(!laco.grudado) {
			for(var col=0; col<dispatcher.getNumManifolds(); col++) {
				var colisao = dispatcher.getManifoldByIndexInternal(col);
				var obj1 = colisao.getBody0();
				var obj2 = colisao.getBody1();
				
				// Verificar por colisoes da Lança com o Teto
				if((obj1.ptr === laco._lanca.body.ptr && obj2.ptr === teto.userData.physicsBody.ptr) ||
						(obj1.ptr === teto.userData.physicsBody.ptr && obj2.ptr === laco._lanca.body.ptr)) {
					
					laco._lanca.grudar();
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
				ropePositions[ indexFloat++ ] = 0;
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
	
	initPhysics();
	initScene();
	initObjs();
	initInput();
	animate();
	
/*	setInterval(function(){
		var v = deteremineScreenCoordinate(bola._mesh);
		console.log(v.x + " " + v.y + " " + v.z);
	}, 1000);*/
});
