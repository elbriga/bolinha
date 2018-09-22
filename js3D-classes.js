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
			this.novoLaco(ropeEnd, tamanho);
			
			// "Enrolar" a corda!
			var nodes = this._corda.body.get_m_nodes();
			var segmentLength = tamanho / corda_segmentos;
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
