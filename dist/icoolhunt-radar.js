(function(root, undefined) {

  "use strict";


var defaultConfig = {
	width: '100px',
	height: '100px',
	radarHandlersRadius: 5, // the radius of the circles used to drag the values
	minRadius: 20, // the minimum radius from which the radar starts
	radarPathInterpolation: "linear-closed",
	maxValue: 100,
	radarMargin: 0.1, // how much margin from data max value and end of radar grid
	exponent: 2, // 1 to use a linear scale; otherwise, a pow() scale will be used
	grid: 10, //in how many sectors should grid be divided
	axeLabelsSpace: 2, // the space between axes text and the concentric grid circles
	equalize: true, //if true, changing one value will result in all other to decrease (and vice-versa), in order to mantain a constant sum
	element: '.radar'
};

/* global d3*/
/* icoolhunt-radar main */

var extend = function(dst, src){
	var ret = [];
	for (var attrname in dst) { ret[attrname] = src[attrname] !== undefined ? src[attrname] :  dst[attrname]; }
	return ret;
};
// Base function.
function icoolhuntRadar(config) {
	/*jshint validthis: true */
	var $this = this;
	//we extend default configuration with the one passed by callee
	this.config = extend(defaultConfig, config);
	this.data = config.data;

	this.config.svgCenter = {x:this.config.width/2, y:this.config.height/2}; //where should the center of our radar be?
	
	this.coordG = this.getPolarCoordGenerator(this.config.svgCenter);
  
	//radar Radius is half the minimum dimension of svg, less a margin which is due to the handles radius
	this.config.radarRadius = (Math.min(this.config.height,this.config.width) / 2) - this.config.radarHandlersRadius;

	this.angleCalculator = this.equalAngleCalculator(this.data.length, - Math.PI / 2);

	
	this.config.total = 0;
	//add x,y coordinates to data: needed for d3's drag and drop
	this.data.forEach(function(element, index, array){
		array[index].i = index;
		array[index].gridLine = {p0:{x:0,y:0},p1:{x:0,p:0}}; // we create a container to save the radar segment to be used as a constraint when dragdropping handlers
		array[index].defaultConfig = $this.config;
		$this.config.total += element.value;
	});

	this.config.maxValue = Math.max(this.config.maxValue, this.config.total);

	//Main scale definition
	this.scale= d3.scale.pow().exponent(1/$this.config.exponent)
		.domain([0, $this.config.maxValue]) //the input range is between 0 and the max value found in data
		.range([$this.config.minRadius,$this.config.radarRadius * (1 - $this.config.radarMargin)]); //the output range is between a minimum distance from the center (10) and radar radius

	//We draw the svg container
	this.svg = d3.select($this.config.element)
		.append("svg")
		.attr('width',$this.config.width)
		.attr('height',$this.config.height);

	//We draw the radar grid
	this.drawRadarGrid();

	//We draw the radar path
	this.drawRadarPath();

	//We draw the drag 'n drop handles
	this.drawRadarHandlers();

}
icoolhuntRadar.prototype = {
	/*jshint validthis: true */
	VERSION: '0.0.0', // Version.

	drawDataLabels: function(){
		var $this = this;
		var dataLabels = this.svg.selectAll("text.data-labels")
			.data($this.data);

		dataLabels
			.enter()
			.append("text")
			.attr("class","data-labels");

		dataLabels
			.text(function(d){return d.name + " (" + d.value.toFixed(0) + "%)";})
			.attr("transform", function(d,i) {
				var ret = $this.coordG($this.angleCalculator(i), $this.config.radarRadius - 100);
				return "translate(" + ret.x + "," + ret.y + ") rotate(" + $this.angleCalculator(i)* (180/Math.PI) +")";
		    })
		    .attr("dy",-4);
	},

	// Draws the radar grid
	drawRadarGrid: function( ){
		var $this = this;
		$this.valueGrid = d3.range(0,$this.config.maxValue,defaultConfig.grid);

		//The concentric grid
		var concentricGrid = this.svg.selectAll("circle.radar-grid")
			.data($this.valueGrid);

		concentricGrid
			.enter()
			.append("circle")
			.attr("class", "radar-grid");

		concentricGrid
			.attr("cx", $this.config.svgCenter.x)
			.attr("cy", $this.config.svgCenter.y)
			.attr("r", function(d){ return $this.scale(d);});

		//The concentric grid's labels
		var axeLabels = this.svg.selectAll("text.axe-labels")
			.data($this.valueGrid);

		axeLabels
			.enter()
			.append("text")
			.attr("class","axe-labels");

		axeLabels
			.text(function(d){return d + "%";})
			.attr("x", $this.config.svgCenter.x)
			.attr("y", function(d){return ($this.config.svgCenter.y - $this.scale(d) - $this.config.axeLabelsSpace);});

		// one line for each value
		var lines = this.svg.selectAll("line")
			.data($this.data)
			.enter()
			.append("line")
			.attr("class", "radar-grid");

		lines
			.attr("x1",function(d,i){
				var ret = $this.coordG($this.angleCalculator(i), $this.config.minRadius);
				d.gridLine.p0.x = ret.x;
				d.gridLine.p0.y = ret.y;
				return ret.x;
			}) // we also want to save the grid to the data as reference for d&d
			.attr("y1",function(d,i){return $this.coordG($this.angleCalculator(i), $this.config.minRadius).y;})
			.attr("x2",function(d,i){
				var ret = $this.coordG($this.angleCalculator(i), d.defaultConfig.radarRadius);
				d.gridLine.p1.x = ret.x;
				d.gridLine.p1.y = ret.y;
				return ret.x;
			})
			.attr("y2",function(d,i){return $this.coordG($this.angleCalculator(i), d.defaultConfig.radarRadius).y;});

		this.drawDataLabels();

	},
	drawRadarPath: function(){
		var $this = this;
		var lineFunction = d3.svg.line()
			.x(function(d,i) { return $this.coordG($this.angleCalculator(i), $this.scale(d.value)).x;})
			.y(function(d,i) { return $this.coordG($this.angleCalculator(i), $this.scale(d.value)).y;})
			.interpolate($this.config.radarPathInterpolation);

		var path = this.svg.selectAll("path")
			.data([$this.data]);

		path
			.enter()
			.append("path")
			.attr("stroke-width", 2)
			.attr("class", "radar-path");

		path
			.attr("d", lineFunction($this.data));
			
	},
	dragmove: function(d,$this) {
		
		// we need to constrain the handler's movement along the radar grid;
		// to do so, we move the point on the projection of the mouse poisition on the radar grid
		// see this example to understand:
		// http://bl.ocks.org/mbostock/4281513
		
		// those three functions are from this SO question:
		// http://stackoverflow.com/questions/849211/shortest-distance-between-a-point-and-a-line-segment
		function sqr(x) { return x * x; }
		function dist2(v, w) { return sqr(v.x - w.x) + sqr(v.y - w.y); }
		
		//gets the projection of a point 'p' on a segment defined by the two points 'v' and 'w'
		function getProjection(p, v, w) {
		  var l2 = dist2(v, w);
		  if (l2 === 0) {return dist2(p, v);}
		  var t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
		  if (t < 0) {return dist2(p, v);}
		  if (t > 1) {return dist2(p, w);}
		  var projection = { x: v.x + t * (w.x - v.x),
		                    y: v.y + t * (w.y - v.y) };
		  return projection;
		}

		var pointPosition = getProjection({x: d3.event.x,y: d3.event.y}, d.gridLine.p0, d.gridLine.p1);
		
		var distanceFromMin = Math.sqrt(dist2(d.gridLine.p0, pointPosition));
		
		var positionToValueScale = d3.scale.pow().exponent($this.config.exponent)
			.domain([0,$this.config.radarRadius * (1 - $this.config.radarMargin)]) //the input range is between 0 and radar radius
			.range([0, d.defaultConfig.maxValue ]); //the output range is between 0 and the max value of the data
		
		var newVal = positionToValueScale(distanceFromMin);

		newVal = Math.min(newVal, $this.config.maxValue); // we do not want our values to be greater than max value, of course!
		
		if ($this.config.equalize){
			if (!isNaN(newVal)){
				var difference = d.value - newVal, // how much we have to redistribute to other values
				toDistribute = difference / (d.defaultConfig.total - d.value);

				var newTotal = 0;
				$this.data.forEach(function(element,index){
					if(d.i !== index){
						element.value += toDistribute * element.value;
					}
					newTotal += element.value;
				});
				
				newTotal = newTotal - d.value + newVal;
				
				//are we drifting away from the starting total? let's correct it:
				var error = newTotal - $this.config.total;
				d.value = newVal - error;
			}
		} else {
			d.value = newVal;
		}
		
		
		//redraw the radar path 
		this.drawRadarPath();

		//redraw the drag 'n drop handles 
		this.drawRadarHandlers();

		//redraw data labels
		this.drawDataLabels();
	},
	//Draws the circles used to drag and drop values
	drawRadarHandlers: function(){
		var $this = this;
		var dataCircles = this.svg.selectAll("circle.radar-handlers")
			.data($this.data);

		dataCircles
			.enter()
			.append("circle")
			.attr("r", $this.config.radarHandlersRadius)
			.attr("class","radar-handlers");

		var drag = d3.behavior.drag()
		    .origin(function(d) { return d; })
		    .on("drag", function(d) {$this.dragmove(d,$this);});

		dataCircles
			.attr("cx",function(d,i){
				var ret = $this.coordG($this.angleCalculator(i), $this.scale(d.value));
				d.x = ret.x;
				d.y = ret.y;
				return ret.x;
			})
			.attr("cy",function(d,i){return $this.coordG($this.angleCalculator(i), $this.scale(d.value)).y;})
			.call(drag);

		
	},
	equalAngleCalculator: function(divider, angleOffset){
		return function(i){
			return (2 * Math.PI / divider) * i + angleOffset;
		};
	},
	getPolarCoordGenerator: function(origin){
		return function(angle, length){
			var ret = {
				x:(length * Math.cos(angle)) + origin.x,
				y:(length * Math.sin(angle)) + origin.y
			};
			return ret;
		};
	},
	getConfig: function(){
		return defaultConfig;
	}
};

// Export to the root, which is probably `window`.
root.icoolhuntRadar = icoolhuntRadar;


}(this));
