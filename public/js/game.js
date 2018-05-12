// This example uses the Phaser 2.2.2 framework

// Copyright © 2014 John Watson
// Licensed under the terms of the MIT License

var GameState = function(game) {
};

// Load images and sounds
GameState.prototype.preload = function() {
    this.game.load.tilemap("level1", "/assets/tilemaps/level1.json", null, Phaser.Tilemap.TILED_JSON)
    this.game.load.image("gameTiles", "assets/map.png")
    this.game.load.image("block", "/assets/column.png");
    this.game.load.image("player", "/assets/player.png");
    this.game.load.spritesheet("torch", "/assets/torch.png", 217, 291);
};

// Setup the example
GameState.prototype.create = function() {
    // Set stage background color
    
    this.game.stage.backgroundColor = 0x4488cc;
    this.game.physics.startSystem(Phaser.Physics.ARCADE)
    this.debug = true
    //this.game.add.image(0,0, 'map')

    this.LIGHT_RADIUS = 500
    this.TILE_SIZE = 160
    this.flickerVal = 0
    this.frameCnt = 0
    
    // load the tilemap
    this.map = this.game.add.tilemap('level1');
    this.map.addTilesetImage('map', 'gameTiles');
   
    this.shadowStrength = this.map.properties.shadowStrength
    this.path = this.map.createLayer("Path")
    this.walls = this.map.createLayer("Walls") 

    this.path.resizeWorld()
    this.map.setCollisionBetween(1,100, true, 'Walls')
    // Add the light
    this.lightGroup = this.game.add.group();
    this.map.createFromObjects("Lights", 37, "torch", 0, true, false, this.lightGroup)

    this.lightGroup.forEach(function(light) {
        light.anchor.setTo(.5, .5)
        light.elevation = light.elevation || 1
    })

    this.player = this.game.add.sprite(400, 400, 'player');
    this.player.scale.setTo(.75, .75)
    this.player.radius = 2 * this.TILE_SIZE + .5 * this.TILE_SIZE;
    this.player.flicker = true;
    this.player.isMoving = false
    this.player.elevation = 1
    // Set the pivot point of the light to the center of the texture
    this.player.anchor.setTo(0.5, 0.5);
    
    this.game.physics.arcade.enable(this.player);
    this.lightGroup.add(this.player)

    // Add a torch
    // this.torch = this.game.add.graphics(30, 900);
    // this.torch.beginFill("#FFFFFF", 1);
    // this.lightGroup.add(this.torch)

    // Create a bitmap texture for drawing light cones
    this.bitmap = this.game.add.bitmapData(this.game.width, this.game.height);
    
    this.bitmap.context.strokeStyle = 'rgb(255, 255, 255)';    
    var lightBitmap = this.game.add.image(0, 0, this.bitmap);

    // This bitmap is drawn onto the screen using the MULTIPLY blend mode.
    // Since this bitmap is over the background, dark areas of the bitmap
    // will make the background darker. White areas of the bitmap will allow
    // the normal colors of the background to show through. Blend modes are
    // only supported in WebGL. If your browser doesn't support WebGL then
    // you'll see gray shadows and white light instead of colors and it
    // generally won't look nearly as cool. So use a browser with WebGL.
    lightBitmap.blendMode = Phaser.blendModes.MULTIPLY;
    
    var gradient =  this.bitmap.context.createRadialGradient(
        this.game.input.activePointer.x, this.game.input.activePointer.y, this.LIGHT_RADIUS / 2,
        this.game.input.activePointer.x, this.game.input.activePointer.y, this.LIGHT_RADIUS * (1 + this.game.rnd.integerInRange(1,10)/100));
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
    this.bitmap.context.fillStyle = gradient;
    this.cursors = this.game.input.keyboard.createCursorKeys();
    this.gae
};

// The update() method is called every frame
GameState.prototype.update = function() {
    this.game.physics.arcade.collide(this.player, this.walls)
    this.player.body.collideWorldBounds = false
    // Move the light to the pointer/touch location
    this.player.body.velocity.y = 0;
    this.player.body.velocity.x = 0;

    if (this.player.isMoving == false) {
        var tween
        if(this.cursors.up.isDown) {
            this.player.angle = -180
            tween = this.game.add.tween(this.player).to({ y:'-160'}, 350, Phaser.Easing.Linear.None, true)
            //this.player.y -= 160
        }
        else if(this.cursors.down.isDown) {
            this.player.angle = 0
            tween = this.game.add.tween(this.player).to({ y:'+160'}, 350, Phaser.Easing.Linear.None, true)
        }
        if(this.cursors.left.isDown) {
            this.player.angle = 90
            tween = this.game.add.tween(this.player).to({ x:'-160'}, 350, Phaser.Easing.Linear.None, true)
        }
        else if(this.cursors.right.isDown) {
            this.player.angle = -90
            tween = this.game.add.tween(this.player).to({ x:'+160'}, 350, Phaser.Easing.Linear.None, true)
        }
        if (tween) {
            tween.onStart.add(function() {
                this.player.isMoving = true
            }, this)

            tween.onComplete.add(function() {
                this.player.isMoving = false
            }, this)
        }
    }

    // Next, fill the entire light bitmap with a dark shadow color.
    this.bitmap.context.fillStyle = `rgb(${this.shadowStrength}, ${this.shadowStrength}, ${this.shadowStrength})`;
    this.bitmap.context.fillRect(0, 0, this.game.width, this.game.height);

    // Ray casting!
    // Cast rays at intervals in a large circle around the light.
    // Save all of the intersection points or ray end points if there was no intersection.
    this.lightGroup.forEach(function(light) {

        var points = [];
        // This we need to change to the improved algorithm

        for(var a = 0; a < Math.PI * 2; a += Math.PI/360) {
            // Create a ray from the player to a point on the circle
            var maxDist = Math.sqrt(Math.pow(this.game.width, 2) + Math.pow(this.game.height, 2))
            var ray = new Phaser.Line(light.x, light.y,
                light.x + Math.cos(a) * maxDist, light.y + Math.sin(a) * maxDist);

            // Check if the ray intersected any 
            var intersect = this.getWallIntersection(ray, light);

            // Save the intersection or the end of the ray
            if (intersect) {
                points.push(intersect);
            } else {
                points.push(ray.end);
            }
        }

        // Connect the dots and fill in the shape, which are cones of light,
        // with a bright white color. When multiplied with the background,
        // the white color will allow the full color of the background to
        // shine through.
        
        if (this.frameCnt%5 == 0 && light.flicker) {
            this.flickerVal = this.game.rnd.integerInRange(1,10)/100
        }
        this.frameCnt++
        var gradient =  this.bitmap.context.createRadialGradient(
            light.x, light.y, light.radius / 2,
            light.x, light.y, light.radius * (1 - this.flickerVal));
        
        
        var lightStrength = light.strength || 1.0
        
        gradient.addColorStop(0, 'rgba(255, 234, 200, ' + lightStrength +')');
        gradient.addColorStop(1, 'rgba(255, 234, 200, 0.0)');

        this.bitmap.context.beginPath();
        this.bitmap.context.fillStyle = gradient;
        this.bitmap.context.moveTo(points[0].x, points[0].y);
        for(var i = 0; i < points.length; i++) {
            this.bitmap.context.lineTo(points[i].x, points[i].y);
        }
        this.bitmap.context.closePath();
        this.bitmap.context.fill();

        if (light.flickerOpacity) {
            light.alpha = (lightStrength - this.flickerVal * lightStrength * 5 )
        }
        
    // This just tells the engine it should update the texture cache
    this.bitmap.dirty = true;
    }, this)
    
};

// Given a ray, this function iterates through all of the walls and
// returns the closest wall intersection from the start of the ray
// or null if the ray does not intersect any walls.
GameState.prototype.getWallIntersection = function(ray, light) {
    var distanceToWall = Number.POSITIVE_INFINITY;
    var closestIntersection = null;
    var points = []

    // For each of the walls...
    var walls = this.walls.getRayCastTiles(ray)

    walls.forEach(function(wall) {  
        if (wall.index > -1) {
            // Create an array of lines that represent the four edges of each wall
            var lines = [
                new Phaser.Line(wall.worldX, wall.worldY, wall.worldX + wall.width, wall.worldY),
                new Phaser.Line(wall.worldX, wall.worldY, wall.worldX, wall.worldY + wall.height),
                new Phaser.Line(wall.worldX + wall.width, wall.worldY,
                    wall.worldX + wall.width, wall.worldY + wall.height),
                new Phaser.Line(wall.worldX, wall.worldY + wall.height,
                    wall.worldX + wall.width, wall.worldY + wall.height)
            ];

            wall.elevation = wall.elevation || 1

            // If the light is at the same level or lower, the object completely blocks the light
            if (light.elevation <= wall.elevation) {
                // Test each of the edges in this wall against the ray.
                // If the ray intersects any of the edges then the wall must be in the way.
                for(var i = 0; i < lines.length; i++) {
                    var intersect = Phaser.Line.intersects(ray, lines[i]);
                    if (intersect) {
                        // Find the closest intersection
                        distance =
                            this.game.math.distance(ray.start.x, ray.start.y, intersect.x, intersect.y);
                        if (distance < distanceToWall) {
                            distanceToWall = distance;
                            closestIntersection = intersect;
                        }
                    }
                }
            } 
        }
    }, this)   
    this.debug = false
    return closestIntersection
};


// Setup game
var game = new Phaser.Game(965, 967, Phaser.CANVAS, 'game');
game.state.add('game', GameState, true);