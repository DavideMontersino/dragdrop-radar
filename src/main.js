/* global d3*/
/* icoolhunt-radar main */

var extend = function(dst, src){
		for (var attrname in src) { dst[attrname] = src[attrname]; }
};
// Base function.
var icoolhuntRadar = function(config) {
	//we extend default configuration with the one passed by callee
	extend(defaultConfig, config);

	defaultConfig.svgCenter = {x:defaultConfig.width/2, y:defaultConfig.height/2}; //where should the center of our radar be?
	
	defaultConfig.coordG = icoolhuntRadar.getPolarCoordGenerator(defaultConfig.svgCenter);
  
	//radar Radius is half the minimum dimension of svg, less a margin which is due to the handles radius
	defaultConfig.radarRadius = (Math.min(defaultConfig.height,defaultConfig.width) / 2) - defaultConfig.radarHandlersRadius;

	defaultConfig.angleCalculator = icoolhuntRadar.equalAngleCalculator(defaultConfig.data.length, - Math.PI / 2);

	
	defaultConfig.total = 0;
	//add x,y coordinates to data: needed for d3's drag and drop
	defaultConfig.data.forEach(function(element, index, array){
		array[index].i = index;
		array[index].gridLine = {p0:{x:0,y:0},p1:{x:0,p:0}}; // we create a container to save the radar segment to be used as a constraint when dragdropping handlers
		array[index].defaultConfig = defaultConfig;
		defaultConfig.total += element.value;
	});

	defaultConfig.maxValue = Math.max(defaultConfig.maxValue, defaultConfig.total);

	//Main scale definition
	defaultConfig.scale = d3.scale.pow().exponent(1/defaultConfig.exponent)
		.domain([0, defaultConfig.maxValue]) //the input range is between 0 and the max value found in data
		.range([defaultConfig.minRadius,defaultConfig.radarRadius * (1 - defaultConfig.radarMargin)]); //the output range is between a minimum distance from the center (10) and radar radius

	//We draw the svg container
	defaultConfig.svg = d3.select(defaultConfig.element)
		.append("svg")
		.attr('width',defaultConfig.width)
		.attr('height',defaultConfig.height);

	//We draw the radar grid
	icoolhuntRadar.drawRadarGrid();

	//We draw the radar path
	icoolhuntRadar.drawRadarPath();

	//We draw the drag 'n drop handles
	icoolhuntRadar.drawRadarHandlers();

};

icoolhuntRadar.drawDataLabels = function(){
	var dataLabels = defaultConfig.svg.selectAll("text.dataLabels")
		.data(defaultConfig.data);

	dataLabels
		.enter()
		.append("text")
		.attr("class","data-labels");

	dataLabels
		.text(function(d){return d.name + " (" + d.value.toFixed(0) + "%)";})
		.attr("transform", function(d,i) {
			var ret = defaultConfig.coordG(defaultConfig.angleCalculator(i), defaultConfig.radarRadius - 100);
			return "translate(" + ret.x + "," + ret.y + ") rotate(" + defaultConfig.angleCalculator(i)* (180/Math.PI) +")";
	    })
	    .attr("dy",-4);
};
// Draws the radar grid
icoolhuntRadar.drawRadarGrid = function( ){
	defaultConfig.valueGrid = d3.range(0,defaultConfig.maxValue,defaultConfig.grid);

	//The concentric grid
	var concentricGrid = defaultConfig.svg.selectAll("circle.radar-grid")
		.data(defaultConfig.valueGrid);

	concentricGrid
		.enter()
		.append("circle")
		.attr("class", "radar-grid");

	concentricGrid
		.attr("cx", defaultConfig.svgCenter.x)
		.attr("cy", defaultConfig.svgCenter.y)
		.attr("r", function(d){ return defaultConfig.scale(d);});

	//The concentric grid's labels
	var axeLabels = defaultConfig.svg.selectAll("text.axe-labels")
		.data(defaultConfig.valueGrid);

	axeLabels
		.enter()
		.append("text")
		.attr("class","axe-labels");

	axeLabels
		.text(function(d){return d + "%";})
		.attr("x", defaultConfig.svgCenter.x)
		.attr("y", function(d){return (defaultConfig.svgCenter.y - defaultConfig.scale(d) - defaultConfig.axeLabelsSpace);});

	// one line for each value
	var lines = defaultConfig.svg.selectAll("line")
		.data(defaultConfig.data)
		.enter()
		.append("line")
		.attr("class", "radar-grid");

	lines
		.attr("x1",function(d,i){
			var ret = defaultConfig.coordG(defaultConfig.angleCalculator(i), defaultConfig.minRadius);
			d.gridLine.p0.x = ret.x;
			d.gridLine.p0.y = ret.y;
			return ret.x;
		}) // we also want to save the grid to the data as reference for d&d
		.attr("y1",function(d,i){return defaultConfig.coordG(defaultConfig.angleCalculator(i), defaultConfig.minRadius).y;})
		.attr("x2",function(d,i){
			var ret = defaultConfig.coordG(defaultConfig.angleCalculator(i), d.defaultConfig.radarRadius);
			d.gridLine.p1.x = ret.x;
			d.gridLine.p1.y = ret.y;
			return ret.x;
		})
		.attr("y2",function(d,i){return defaultConfig.coordG(defaultConfig.angleCalculator(i), d.defaultConfig.radarRadius).y;});

	icoolhuntRadar.drawDataLabels();

};


icoolhuntRadar.drawRadarPath = function(){
	var lineFunction = d3.svg.line()
		.x(function(d,i) { return defaultConfig.coordG(defaultConfig.angleCalculator(i), defaultConfig.scale(d.value)).x;})
		.y(function(d,i) { return defaultConfig.coordG(defaultConfig.angleCalculator(i), defaultConfig.scale(d.value)).y;})
		.interpolate(defaultConfig.radarPathInterpolation);

	var path = defaultConfig.svg.selectAll("path")
		.data([defaultConfig.data]);

	path
		.enter()
		.append("path")
		.attr("stroke-width", 2)
		.attr("class", "radar-path");

	path
		.attr("d", lineFunction(defaultConfig.data));
		
};

icoolhuntRadar.dragmove = function(d) {

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
	
	var positionToValueScale = d3.scale.pow().exponent(defaultConfig.exponent)
		.domain([0,d.defaultConfig.radarRadius * (1 - defaultConfig.radarMargin)]) //the input range is between 0 and radar radius
		.range([0, d.defaultConfig.maxValue ]); //the output range is between 0 and the max value of the data
	
	var newVal = positionToValueScale(distanceFromMin);

	newVal = Math.min(newVal, defaultConfig.maxValue); // we do not want our values to be greater than max value, of course!
	if (!isNaN(newVal)){
		var difference = d.value - newVal, // how much we have to redistribute to other values
		toDistribute = difference / (d.defaultConfig.total - d.value);

		var newTotal = 0;
		defaultConfig.data.forEach(function(element,index){
			if(d.i !== index){
				element.value += toDistribute * element.value;
			}
			newTotal += element.value;
		});
		
		newTotal = newTotal - d.value + newVal;
		
		//are we drifting away from the starting total? let's correct it:
		var error = newTotal - defaultConfig.total;
		d.value = newVal - error;
		console.log(d.value);
	}
	
	//draw the radar path 
	icoolhuntRadar.drawRadarPath();

	//draw the drag 'n drop handles 
	icoolhuntRadar.drawRadarHandlers();
};

//Draws the circles used to drag and drop values
icoolhuntRadar.drawRadarHandlers = function(){
	var dataCircles = defaultConfig.svg.selectAll("circle.radar-handlers")
		.data(defaultConfig.data);

	dataCircles
		.enter()
		.append("circle")
		.attr("r", defaultConfig.radarHandlersRadius)
		.attr("class","radar-handlers");

	var drag = d3.behavior.drag()
	    .origin(function(d) { return d; })
	    .on("drag", icoolhuntRadar.dragmove);

	dataCircles
		.attr("cx",function(d,i){
			var ret = defaultConfig.coordG(defaultConfig.angleCalculator(i), defaultConfig.scale(d.value));
			d.x = ret.x;
			d.y = ret.y;
			return ret.x;
		})
		.attr("cy",function(d,i){return defaultConfig.coordG(defaultConfig.angleCalculator(i), defaultConfig.scale(d.value)).y;})
		.call(drag);

	
};

icoolhuntRadar.equalAngleCalculator = function(divider, angleOffset){
	return function(i){
		return (2 * Math.PI / divider) * i + angleOffset;
	};
};

icoolhuntRadar.getPolarCoordGenerator = function(origin){
	return function(angle, length){
		var ret = {
			x:(length * Math.cos(angle)) + origin.x,
			y:(length * Math.sin(angle)) + origin.y
		};
		return ret;
	};
};
// Version.
icoolhuntRadar.VERSION = '0.0.0';

icoolhuntRadar.getConfig = function(){
	return defaultConfig;
};

// Export to the root, which is probably `window`.
root.icoolhuntRadar = icoolhuntRadar;
