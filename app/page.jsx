'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'

export default function DrivingSimulation () {
  const mountRef = useRef(null)

  useEffect(() => {
    // Scene setup
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x87ceeb) // Sky blue background

    // Camera setup
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    )
    camera.position.set(50, 50, 50)
    camera.lookAt(0, 0, 0)

    // Keyboard state tracking
    const keyState = {
      w: false,
      a: false,
      s: false,
      d: false,
      space: false
    }

    // Player car variables
    let playerCar
    let playerSpeed = 0
    const maxSpeed = 0.5
    const acceleration = 0.01
    const deceleration = 0.005
    const brakeStrength = 0.03
    const turnSpeed = 0.03

    // Event listeners for keyboard controls
    const handleKeyDown = (e) => {
      if (e.key.toLowerCase() === 'w') keyState.w = true
      if (e.key.toLowerCase() === 'a') keyState.a = true
      if (e.key.toLowerCase() === 's') keyState.s = true
      if (e.key.toLowerCase() === 'd') keyState.d = true
      if (e.key === ' ') keyState.space = true
    }

    const handleKeyUp = (e) => {
      if (e.key.toLowerCase() === 'w') keyState.w = false
      if (e.key.toLowerCase() === 'a') keyState.a = false
      if (e.key.toLowerCase() === 's') keyState.s = false
      if (e.key.toLowerCase() === 'd') keyState.d = false
      if (e.key === ' ') keyState.space = false
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.shadowMap.enabled = true

    // Add renderer to DOM
    mountRef.current.appendChild(renderer.domElement)

    // Controls for camera
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.05

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
    scene.add(ambientLight)

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
    directionalLight.position.set(50, 100, 50)
    directionalLight.castShadow = true
    directionalLight.shadow.mapSize.width = 2048
    directionalLight.shadow.mapSize.height = 2048
    directionalLight.shadow.camera.near = 0.5
    directionalLight.shadow.camera.far = 500
    directionalLight.shadow.camera.left = -100
    directionalLight.shadow.camera.right = 100
    directionalLight.shadow.camera.top = 100
    directionalLight.shadow.camera.bottom = -100
    scene.add(directionalLight)

    // Ground
    const groundGeometry = new THREE.PlaneGeometry(200, 200)
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x1a5e1a,
      roughness: 0.8
    })
    const ground = new THREE.Mesh(groundGeometry, groundMaterial)
    ground.rotation.x = -Math.PI / 2
    ground.receiveShadow = true
    scene.add(ground)

    // City grid
    const gridSize = 5
    const blockSize = 20
    const streetWidth = 10
    const citySize = gridSize * (blockSize + streetWidth)

    // Create buildings
    function createBuilding (x, z, width, depth, height) {
      const buildingGeometry = new THREE.BoxGeometry(width, height, depth)
      const buildingMaterial = new THREE.MeshStandardMaterial({
        color: Math.random() * 0xffffff,
        roughness: 0.7,
        metalness: 0.2
      })
      const building = new THREE.Mesh(buildingGeometry, buildingMaterial)
      building.position.set(x, height / 2, z)
      building.castShadow = true
      building.receiveShadow = true
      scene.add(building)

      // Add windows
      const windowSize = 1.5
      const windowSpacing = 3
      const windowGeometry = new THREE.PlaneGeometry(windowSize, windowSize)
      const windowMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffcc,
        emissive: 0x555555,
        roughness: 0.1,
        metalness: 0.8
      })

      // Front windows
      for (
        let wx = -width / 2 + windowSpacing;
        wx < width / 2 - windowSpacing;
        wx += windowSpacing
      ) {
        for (
          let wy = windowSpacing;
          wy < height - windowSpacing;
          wy += windowSpacing
        ) {
          const window = new THREE.Mesh(windowGeometry, windowMaterial)
          window.position.set(x + wx, wy, z + depth / 2 + 0.01)
          scene.add(window)
        }
      }

      // Back windows
      for (
        let wx = -width / 2 + windowSpacing;
        wx < width / 2 - windowSpacing;
        wx += windowSpacing
      ) {
        for (
          let wy = windowSpacing;
          wy < height - windowSpacing;
          wy += windowSpacing
        ) {
          const window = new THREE.Mesh(windowGeometry, windowMaterial)
          window.position.set(x + wx, wy, z - depth / 2 - 0.01)
          window.rotation.y = Math.PI
          scene.add(window)
        }
      }

      // Side windows
      for (
        let wz = -depth / 2 + windowSpacing;
        wz < depth / 2 - windowSpacing;
        wz += windowSpacing
      ) {
        for (
          let wy = windowSpacing;
          wy < height - windowSpacing;
          wy += windowSpacing
        ) {
          const window1 = new THREE.Mesh(windowGeometry, windowMaterial)
          window1.position.set(x + width / 2 + 0.01, wy, z + wz)
          window1.rotation.y = Math.PI / 2
          scene.add(window1)

          const window2 = new THREE.Mesh(windowGeometry, windowMaterial)
          window2.position.set(x - width / 2 - 0.01, wy, z + wz)
          window2.rotation.y = -Math.PI / 2
          scene.add(window2)
        }
      }
    }

    // Create city blocks
    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        const blockX =
          i * (blockSize + streetWidth) - citySize / 2 + blockSize / 2
        const blockZ =
          j * (blockSize + streetWidth) - citySize / 2 + blockSize / 2

        // Create 1-4 buildings per block
        const buildingsPerBlock = Math.floor(Math.random() * 4) + 1

        if (buildingsPerBlock === 1) {
          // One large building
          const height = 10 + Math.random() * 40
          createBuilding(
            blockX,
            blockZ,
            blockSize * 0.8,
            blockSize * 0.8,
            height
          )
        } else {
          // Multiple smaller buildings
          const subBlockSize = blockSize / Math.sqrt(buildingsPerBlock)
          for (let k = 0; k < buildingsPerBlock; k++) {
            const offsetX = (Math.random() - 0.5) * (blockSize - subBlockSize)
            const offsetZ = (Math.random() - 0.5) * (blockSize - subBlockSize)
            const height = 5 + Math.random() * 25
            const width = subBlockSize * (0.5 + Math.random() * 0.5)
            const depth = subBlockSize * (0.5 + Math.random() * 0.5)
            createBuilding(
              blockX + offsetX,
              blockZ + offsetZ,
              width,
              depth,
              height
            )
          }
        }
      }
    }

    // Create roads
    const roadMaterial = new THREE.MeshStandardMaterial({
      color: 0x333333,
      roughness: 0.9
    })

    // Horizontal roads
    for (let i = 0; i <= gridSize; i++) {
      const roadX =
        i * (blockSize + streetWidth) - citySize / 2 - streetWidth / 2
      const roadGeometry = new THREE.PlaneGeometry(streetWidth, citySize)
      const road = new THREE.Mesh(roadGeometry, roadMaterial)
      road.rotation.x = -Math.PI / 2
      road.position.set(roadX + streetWidth / 2, 0.01, 0)
      road.receiveShadow = true
      scene.add(road)
    }

    // Vertical roads
    for (let j = 0; j <= gridSize; j++) {
      const roadZ =
        j * (blockSize + streetWidth) - citySize / 2 - streetWidth / 2
      const roadGeometry = new THREE.PlaneGeometry(citySize, streetWidth)
      const road = new THREE.Mesh(roadGeometry, roadMaterial)
      road.rotation.x = -Math.PI / 2
      road.position.set(0, 0.01, roadZ + streetWidth / 2)
      road.receiveShadow = true
      scene.add(road)
    }

    // Create cars
    const cars = []

    function createCar (x, z, direction) {
      const carGroup = new THREE.Group()

      // Car body
      const bodyGeometry = new THREE.BoxGeometry(2, 1, 4)
      const bodyMaterial = new THREE.MeshStandardMaterial({
        color: Math.random() * 0xffffff,
        roughness: 0.5,
        metalness: 0.7
      })
      const body = new THREE.Mesh(bodyGeometry, bodyMaterial)
      body.position.y = 0.5
      carGroup.add(body)

      // Car top
      const topGeometry = new THREE.BoxGeometry(1.8, 0.8, 2)
      const topMaterial = new THREE.MeshStandardMaterial({
        color: bodyMaterial.color,
        roughness: 0.5,
        metalness: 0.7
      })
      const top = new THREE.Mesh(topGeometry, topMaterial)
      top.position.set(0, 1.4, -0.5)
      carGroup.add(top)

      // Wheels
      const wheelGeometry = new THREE.CylinderGeometry(0.5, 0.5, 0.4, 16)
      const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x111111 })

      const wheel1 = new THREE.Mesh(wheelGeometry, wheelMaterial)
      wheel1.position.set(1.1, 0.5, 1.2)
      wheel1.rotation.z = Math.PI / 2
      carGroup.add(wheel1)

      const wheel2 = new THREE.Mesh(wheelGeometry, wheelMaterial)
      wheel2.position.set(-1.1, 0.5, 1.2)
      wheel2.rotation.z = Math.PI / 2
      carGroup.add(wheel2)

      const wheel3 = new THREE.Mesh(wheelGeometry, wheelMaterial)
      wheel3.position.set(1.1, 0.5, -1.2)
      wheel3.rotation.z = Math.PI / 2
      carGroup.add(wheel3)

      const wheel4 = new THREE.Mesh(wheelGeometry, wheelMaterial)
      wheel4.position.set(-1.1, 0.5, -1.2)
      wheel4.rotation.z = Math.PI / 2
      carGroup.add(wheel4)

      // Headlights
      const headlightGeometry = new THREE.SphereGeometry(0.2, 16, 16)
      const headlightMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffcc,
        emissive: 0xffffcc,
        emissiveIntensity: 0.5
      })

      const headlight1 = new THREE.Mesh(headlightGeometry, headlightMaterial)
      headlight1.position.set(0.7, 0.5, 2)
      carGroup.add(headlight1)

      const headlight2 = new THREE.Mesh(headlightGeometry, headlightMaterial)
      headlight2.position.set(-0.7, 0.5, 2)
      carGroup.add(headlight2)

      // Taillights
      const taillightMaterial = new THREE.MeshStandardMaterial({
        color: 0xff0000,
        emissive: 0xff0000,
        emissiveIntensity: 0.5
      })

      const taillight1 = new THREE.Mesh(headlightGeometry, taillightMaterial)
      taillight1.position.set(0.7, 0.5, -2)
      carGroup.add(taillight1)

      const taillight2 = new THREE.Mesh(headlightGeometry, taillightMaterial)
      taillight2.position.set(-0.7, 0.5, -2)
      carGroup.add(taillight2)

      carGroup.position.set(x, 0, z)

      if (direction === 'horizontal') {
        carGroup.rotation.y = Math.PI / 2
      }

      carGroup.castShadow = true
      carGroup.receiveShadow = true
      scene.add(carGroup)

      return {
        mesh: carGroup,
        direction: direction,
        speed: 0.1 + Math.random() * 0.2,
        lastTurnTime: 0,
        turnProbability: 0.01 + Math.random() * 0.02
      }
    }

    // Add cars to roads
    for (let i = 0; i < 20; i++) {
      let x, z, direction, movingDirection

      if (Math.random() > 0.5) {
        // Horizontal road
        direction = 'horizontal'
        movingDirection = Math.random() > 0.5 ? 1 : -1 // Random direction (positive or negative)
        const roadIndex = Math.floor(Math.random() * (gridSize + 1))
        z =
          roadIndex * (blockSize + streetWidth) -
          citySize / 2 -
          streetWidth / 2 +
          streetWidth / 2
        x = (Math.random() - 0.5) * citySize
      } else {
        // Vertical road
        direction = 'vertical'
        movingDirection = Math.random() > 0.5 ? 1 : -1 // Random direction (positive or negative)
        const roadIndex = Math.floor(Math.random() * (gridSize + 1))
        x =
          roadIndex * (blockSize + streetWidth) -
          citySize / 2 -
          streetWidth / 2 +
          streetWidth / 2
        z = (Math.random() - 0.5) * citySize
      }

      const car = createCar(x, z, direction)
      car.speed *= movingDirection // Apply direction to speed
      car.lastTurnTime = 0 // Track when the car last turned
      car.turnProbability = 0.01 + Math.random() * 0.02 // Different turn probabilities for each car

      // Rotate car if moving in negative direction
      if (movingDirection < 0) {
        if (direction === 'horizontal') {
          car.mesh.rotation.y += Math.PI
        } else {
          car.mesh.rotation.y += Math.PI
        }
      }

      cars.push(car)
    }

    // Create people
    const people = []

    function createPerson (x, z) {
      const personGroup = new THREE.Group()

      // Body
      const bodyGeometry = new THREE.CylinderGeometry(0.25, 0.25, 1, 8)
      const bodyMaterial = new THREE.MeshStandardMaterial({
        color: Math.random() * 0xffffff,
        roughness: 0.8
      })
      const body = new THREE.Mesh(bodyGeometry, bodyMaterial)
      body.position.y = 0.5
      personGroup.add(body)

      // Head
      const headGeometry = new THREE.SphereGeometry(0.25, 16, 16)
      const headMaterial = new THREE.MeshStandardMaterial({
        color: 0xffdbac,
        roughness: 0.8
      })
      const head = new THREE.Mesh(headGeometry, headMaterial)
      head.position.y = 1.25
      personGroup.add(head)

      // Legs
      const legGeometry = new THREE.CylinderGeometry(0.1, 0.1, 0.7, 8)
      const legMaterial = new THREE.MeshStandardMaterial({
        color: 0x0000ff,
        roughness: 0.8
      })

      const leg1 = new THREE.Mesh(legGeometry, legMaterial)
      leg1.position.set(0.15, -0.35, 0)
      personGroup.add(leg1)

      const leg2 = new THREE.Mesh(legGeometry, legMaterial)
      leg2.position.set(-0.15, -0.35, 0)
      personGroup.add(leg2)

      personGroup.position.set(x, 0, z)
      personGroup.castShadow = true
      personGroup.receiveShadow = true
      scene.add(personGroup)

      return {
        mesh: personGroup,
        direction: Math.random() * Math.PI * 2,
        speed: 0.03 + Math.random() * 0.02,
        walkCycle: Math.random() * Math.PI * 2
      }
    }

    // Add people to sidewalks
    for (let i = 0; i < 30; i++) {
      let x, z

      // Position people along sidewalks
      if (Math.random() > 0.5) {
        // Horizontal sidewalk
        const roadIndex = Math.floor(Math.random() * (gridSize + 1))
        z =
          roadIndex * (blockSize + streetWidth) -
          citySize / 2 -
          streetWidth / 2 +
          streetWidth / 2
        z += Math.random() > 0.5 ? streetWidth * 0.4 : -streetWidth * 0.4
        x = (Math.random() - 0.5) * citySize
      } else {
        // Vertical sidewalk
        const roadIndex = Math.floor(Math.random() * (gridSize + 1))
        x =
          roadIndex * (blockSize + streetWidth) -
          citySize / 2 -
          streetWidth / 2 +
          streetWidth / 2
        x += Math.random() > 0.5 ? streetWidth * 0.4 : -streetWidth * 0.4
        z = (Math.random() - 0.5) * citySize
      }

      people.push(createPerson(x, z))
    }

    // Create player car
    function createPlayerCar () {
      const carGroup = new THREE.Group()

      // Car body - slightly larger and sportier than regular cars
      const bodyGeometry = new THREE.BoxGeometry(2.2, 1, 4.5)
      const bodyMaterial = new THREE.MeshStandardMaterial({
        color: 0xff0000, // Red car for player
        roughness: 0.3,
        metalness: 0.8
      })
      const body = new THREE.Mesh(bodyGeometry, bodyMaterial)
      body.position.y = 0.5
      carGroup.add(body)

      // Car top
      const topGeometry = new THREE.BoxGeometry(2, 0.8, 2.2)
      const topMaterial = new THREE.MeshStandardMaterial({
        color: 0xff2200,
        roughness: 0.3,
        metalness: 0.8
      })
      const top = new THREE.Mesh(topGeometry, topMaterial)
      top.position.set(0, 1.4, -0.3)
      carGroup.add(top)

      // Wheels
      const wheelGeometry = new THREE.CylinderGeometry(0.5, 0.5, 0.4, 16)
      const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x111111 })

      const wheel1 = new THREE.Mesh(wheelGeometry, wheelMaterial)
      wheel1.position.set(1.2, 0.5, 1.4)
      wheel1.rotation.z = Math.PI / 2
      carGroup.add(wheel1)

      const wheel2 = new THREE.Mesh(wheelGeometry, wheelMaterial)
      wheel2.position.set(-1.2, 0.5, 1.4)
      wheel2.rotation.z = Math.PI / 2
      carGroup.add(wheel2)

      const wheel3 = new THREE.Mesh(wheelGeometry, wheelMaterial)
      wheel3.position.set(1.2, 0.5, -1.4)
      wheel3.rotation.z = Math.PI / 2
      carGroup.add(wheel3)

      const wheel4 = new THREE.Mesh(wheelGeometry, wheelMaterial)
      wheel4.position.set(-1.2, 0.5, -1.4)
      wheel4.rotation.z = Math.PI / 2
      carGroup.add(wheel4)

      // Headlights
      const headlightGeometry = new THREE.SphereGeometry(0.25, 16, 16)
      const headlightMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffcc,
        emissive: 0xffffcc,
        emissiveIntensity: 1
      })

      const headlight1 = new THREE.Mesh(headlightGeometry, headlightMaterial)
      headlight1.position.set(0.7, 0.5, 2.25)
      carGroup.add(headlight1)

      const headlight2 = new THREE.Mesh(headlightGeometry, headlightMaterial)
      headlight2.position.set(-0.7, 0.5, 2.25)
      carGroup.add(headlight2)

      // Taillights
      const taillightMaterial = new THREE.MeshStandardMaterial({
        color: 0xff0000,
        emissive: 0xff0000,
        emissiveIntensity: 1
      })

      const taillight1 = new THREE.Mesh(headlightGeometry, taillightMaterial)
      taillight1.position.set(0.7, 0.5, -2.25)
      carGroup.add(taillight1)

      const taillight2 = new THREE.Mesh(headlightGeometry, taillightMaterial)
      taillight2.position.set(-0.7, 0.5, -2.25)
      carGroup.add(taillight2)

      // Place the car on a road
      const randomRoadIndex = Math.floor(Math.random() * (gridSize + 1))
      carGroup.position.set(
        randomRoadIndex * (blockSize + streetWidth) - citySize / 2 - streetWidth / 2 + streetWidth / 2,
        0,
        0
      )

      carGroup.castShadow = true
      carGroup.receiveShadow = true
      scene.add(carGroup)

      return carGroup
    }

    // Initialize player car
    playerCar = createPlayerCar()

    // Initial camera position behind the car
    const initialCameraPosition = new THREE.Vector3(
      playerCar.position.x - Math.sin(playerCar.rotation.y) * 12,
      playerCar.position.y + 5,
      playerCar.position.z - Math.cos(playerCar.rotation.y) * 12
    )
    camera.position.copy(initialCameraPosition)
    camera.lookAt(playerCar.position)

    // Disable orbit controls completely
    controls.enabled = false

    // Animation loop
    function animate () {
      window.requestAnimationFrame(animate)

      // Handle player car controls
      if (keyState.w) {
        // Accelerate forward
        playerSpeed = Math.min(playerSpeed + acceleration, maxSpeed)
      } else if (keyState.s) {
        // Accelerate backward
        playerSpeed = Math.max(playerSpeed - acceleration, -maxSpeed / 1.5)
      } else {
        // Natural deceleration when not pressing forward/backward
        if (playerSpeed > 0) {
          playerSpeed = Math.max(playerSpeed - deceleration, 0)
        } else if (playerSpeed < 0) {
          playerSpeed = Math.min(playerSpeed + deceleration, 0)
        }
      }

      // Apply brakes
      if (keyState.space) {
        if (playerSpeed > 0) {
          playerSpeed = Math.max(playerSpeed - brakeStrength, 0)
        } else if (playerSpeed < 0) {
          playerSpeed = Math.min(playerSpeed + brakeStrength, 0)
        }
      }

      // Turning
      if (keyState.a) {
        playerCar.rotation.y += turnSpeed * (playerSpeed !== 0 ? 1 : 0)
      }
      if (keyState.d) {
        playerCar.rotation.y -= turnSpeed * (playerSpeed !== 0 ? 1 : 0)
      }

      // Move player car
      if (playerSpeed !== 0) {
        playerCar.position.x += Math.sin(playerCar.rotation.y) * playerSpeed
        playerCar.position.z += Math.cos(playerCar.rotation.y) * playerSpeed
      }

      // Keep player within bounds
      const halfCitySize = citySize / 2
      playerCar.position.x = Math.max(Math.min(playerCar.position.x, halfCitySize), -halfCitySize)
      playerCar.position.z = Math.max(Math.min(playerCar.position.z, halfCitySize), -halfCitySize)

      // Update camera to follow car - improved version
      // Set camera directly behind car at fixed distance - more reliable approach
      const cameraDistance = 15 // Increased for better visibility
      const cameraHeight = 6 // Slightly higher for better view

      // Calculate position directly rather than using lerp
      camera.position.set(
        playerCar.position.x - Math.sin(playerCar.rotation.y) * cameraDistance,
        playerCar.position.y + cameraHeight,
        playerCar.position.z - Math.cos(playerCar.rotation.y) * cameraDistance
      )

      // Look at a point slightly above the car
      const carLookPoint = new THREE.Vector3(
        playerCar.position.x,
        playerCar.position.y + 1,
        playerCar.position.z
      )
      camera.lookAt(carLookPoint)

      // Update car positions
      cars.forEach(car => {
        // Increment turn timer
        car.lastTurnTime++

        if (car.direction === 'horizontal') {
          car.mesh.position.x += car.speed

          // Check if car should turn at an intersection inside the city
          const isNearIntersection = Math.abs(Math.round((car.mesh.position.x + citySize / 2) / (blockSize + streetWidth)) *
            (blockSize + streetWidth) - (car.mesh.position.x + citySize / 2)) < 1

          if (isNearIntersection && car.lastTurnTime > 100 && Math.random() < car.turnProbability) {
            // Find the nearest road intersection
            const nearestRoadIndex = Math.round((car.mesh.position.z + citySize / 2) / (blockSize + streetWidth))
            const nearestRoadZ = nearestRoadIndex * (blockSize + streetWidth) - citySize / 2 - streetWidth / 2 + streetWidth / 2

            // Make sure we're not at the edge of the grid
            if (nearestRoadIndex >= 0 && nearestRoadIndex <= gridSize) {
              // Randomly choose to turn left or right
              const turnDirection = Math.random() > 0.5 ? 1 : -1

              // Snap to the intersection
              car.mesh.position.x = Math.round((car.mesh.position.x + citySize / 2) / (blockSize + streetWidth)) *
                (blockSize + streetWidth) - citySize / 2

              // Adjust to the nearest road
              car.mesh.position.z = nearestRoadZ

              // Update direction and rotation
              car.direction = 'vertical'
              car.speed = Math.abs(car.speed) * turnDirection

              // Set proper rotation based on new direction
              if (turnDirection > 0) {
                // Turn south
                car.mesh.rotation.y = car.speed > 0 ? 0 : Math.PI
              } else {
                // Turn north
                car.mesh.rotation.y = car.speed > 0 ? Math.PI : 0
              }

              // Reset turn timer
              car.lastTurnTime = 0
            }
          }

          // Check if car reached the edge of the city
          if ((car.speed > 0 && car.mesh.position.x > citySize / 2) ||
              (car.speed < 0 && car.mesh.position.x < -citySize / 2)) {

            // Find the nearest road intersection
            const nearestRoadIndex = Math.round((car.mesh.position.z + citySize / 2) / (blockSize + streetWidth))
            const nearestRoadZ = nearestRoadIndex * (blockSize + streetWidth) - citySize / 2 - streetWidth / 2 + streetWidth / 2

            // Randomly choose to turn left or right
            const turnDirection = Math.random() > 0.5 ? 1 : -1

            // Position the car at the intersection
            if (car.speed > 0) {
              car.mesh.position.x = citySize / 2 - 2
            } else {
              car.mesh.position.x = -citySize / 2 + 2
            }

            // Adjust to the nearest road
            car.mesh.position.z = nearestRoadZ

            // Update direction and rotation
            car.direction = 'vertical'
            car.speed = Math.abs(car.speed) * turnDirection

            // Set proper rotation based on new direction
            if (turnDirection > 0) {
              // Turn south
              car.mesh.rotation.y = car.speed > 0 ? 0 : Math.PI
            } else {
              // Turn north
              car.mesh.rotation.y = car.speed > 0 ? Math.PI : 0
            }

            // Reset turn timer
            car.lastTurnTime = 0
          }
        } else {
          car.mesh.position.z += car.speed

          // Check if car should turn at an intersection inside the city
          const isNearIntersection = Math.abs(Math.round((car.mesh.position.z + citySize / 2) / (blockSize + streetWidth)) *
            (blockSize + streetWidth) - (car.mesh.position.z + citySize / 2)) < 1

          if (isNearIntersection && car.lastTurnTime > 100 && Math.random() < car.turnProbability) {
            // Find the nearest road intersection
            const nearestRoadIndex = Math.round((car.mesh.position.x + citySize / 2) / (blockSize + streetWidth))
            const nearestRoadX = nearestRoadIndex * (blockSize + streetWidth) - citySize / 2 - streetWidth / 2 + streetWidth / 2

            // Make sure we're not at the edge of the grid
            if (nearestRoadIndex >= 0 && nearestRoadIndex <= gridSize) {
              // Randomly choose to turn left or right
              const turnDirection = Math.random() > 0.5 ? 1 : -1

              // Snap to the intersection
              car.mesh.position.z = Math.round((car.mesh.position.z + citySize / 2) / (blockSize + streetWidth)) *
                (blockSize + streetWidth) - citySize / 2

              // Adjust to the nearest road
              car.mesh.position.x = nearestRoadX

              // Update direction and rotation
              car.direction = 'horizontal'
              car.speed = Math.abs(car.speed) * turnDirection

              // Set proper rotation based on new direction
              if (turnDirection > 0) {
                // Turn east
                car.mesh.rotation.y = car.speed > 0 ? Math.PI / 2 : -Math.PI / 2
              } else {
                // Turn west
                car.mesh.rotation.y = car.speed > 0 ? -Math.PI / 2 : Math.PI / 2
              }

              // Reset turn timer
              car.lastTurnTime = 0
            }
          }

          // Check if car reached the edge of the city
          if ((car.speed > 0 && car.mesh.position.z > citySize / 2) ||
              (car.speed < 0 && car.mesh.position.z < -citySize / 2)) {

            // Find the nearest road intersection
            const nearestRoadIndex = Math.round((car.mesh.position.x + citySize / 2) / (blockSize + streetWidth))
            const nearestRoadX = nearestRoadIndex * (blockSize + streetWidth) - citySize / 2 - streetWidth / 2 + streetWidth / 2

            // Randomly choose to turn left or right
            const turnDirection = Math.random() > 0.5 ? 1 : -1

            // Position the car at the intersection
            if (car.speed > 0) {
              car.mesh.position.z = citySize / 2 - 2
            } else {
              car.mesh.position.z = -citySize / 2 + 2
            }

            // Adjust to the nearest road
            car.mesh.position.x = nearestRoadX

            // Update direction and rotation
            car.direction = 'horizontal'
            car.speed = Math.abs(car.speed) * turnDirection

            // Set proper rotation based on new direction
            if (turnDirection > 0) {
              // Turn east
              car.mesh.rotation.y = car.speed > 0 ? Math.PI / 2 : -Math.PI / 2
            } else {
              // Turn west
              car.mesh.rotation.y = car.speed > 0 ? -Math.PI / 2 : Math.PI / 2
            }

            // Reset turn timer
            car.lastTurnTime = 0
          }
        }
      })

      // Update people positions
      people.forEach(person => {
        person.walkCycle += 0.1

        // Simple walking animation
        const leg1 = person.mesh.children[2]
        const leg2 = person.mesh.children[3]
        leg1.rotation.x = Math.sin(person.walkCycle) * 0.5
        leg2.rotation.x = Math.sin(person.walkCycle + Math.PI) * 0.5

        // Move person
        person.mesh.position.x += Math.cos(person.direction) * person.speed
        person.mesh.position.z += Math.sin(person.direction) * person.speed

        // Keep within city bounds
        if (person.mesh.position.x > citySize / 2) {
          person.direction = Math.PI - person.direction
        }
        if (person.mesh.position.x < -citySize / 2) {
          person.direction = Math.PI - person.direction
        }
        if (person.mesh.position.z > citySize / 2) {
          person.direction = -person.direction
        }
        if (person.mesh.position.z < -citySize / 2) {
          person.direction = -person.direction
        }

        // Update rotation to match direction
        person.mesh.rotation.y = person.direction
      })

      // Don't call controls.update() since we disabled orbit controls
      renderer.render(scene, camera)
    }

    // Handle window resize
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()
      renderer.setSize(window.innerWidth, window.innerHeight)
    }

    window.addEventListener('resize', handleResize)

    animate()

    // Cleanup function
    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      mountRef.current.removeChild(renderer.domElement)
    }
  }, []) // Empty dependency array ensures this runs once on mount

  return (
    <div className='h-screen w-full'>
      <div ref={mountRef} className='w-full h-full' />
    </div>
  )
}
