(function(root, undefined) {

  "use strict";


var defaultConfig = {
	width: '100px',
	height: '100px',
	radarHandlersRadius: 5, // the radius of the circles used to drag the values
	minRadius: 20, // the minimum radius from which the radar starts
	radarPathInterpolation: "cardinal-closed"
};

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
	defaultConfig.maxValue = d3.max(defaultConfig.data.map(function(d){return d.value;})); //The max value found in our data

	var coordG = icoolhuntRadar.getPolarCoordGenerator(defaultConfig.svgCenter);
  
	//radar Radius is half the minimum dimension of svg, less a margin which is due to the handles radius
	defaultConfig.radarRadius = (Math.min(defaultConfig.height,defaultConfig.width) / 2) - defaultConfig.radarHandlersRadius;

	var angleCalculator = icoolhuntRadar.equalAngleCalculator(defaultConfig.data.length, - Math.PI / 2);

	//Main scale definition
	var scale = d3.scale.linear()
		.domain([0, defaultConfig.maxValue]) //the input range is between 0 and the max value found in data
		.range([defaultConfig.minRadius,defaultConfig.radarRadius]); //the output range is between a minimum distance from the center (10) and radar radius

	//add x,y coordinates to data: needed for d3's drag and drop
	defaultConfig.data.forEach(function(element, index, array){
		array[index].i = index;
		array[index].gridLine = {p0:{x:0,y:0},p1:{x:0,p:0}}; // we create a container to save the radar segment to be used as a constraint when dragdropping handlers
		array[index].x = coordG(angleCalculator(index), scale(element.value)).x;
		array[index].y = coordG(angleCalculator(index), scale(element.value)).y;
		array[index].defaultConfig = defaultConfig;
	});

	//We draw the svg container
	var svg = d3.select(defaultConfig.element)
		.append("svg")
		.attr('width',defaultConfig.width)
		.attr('height',defaultConfig.height);

	//We draw the radar grid //TODO remove radarRadius
	icoolhuntRadar.drawRadarGrid(svg, defaultConfig.radarRadius, angleCalculator, coordG);

	//We draw the radar path //TODO remove radarRadius
	icoolhuntRadar.drawRadarPath(svg, defaultConfig.radarRadius,angleCalculator,coordG,scale);

	//We draw the drag 'n drop handles //TODO remove radarRadius
	icoolhuntRadar.drawRadarHandlers(svg, defaultConfig.radarRadius, angleCalculator, coordG, scale);

};

// Draws the radar grid
icoolhuntRadar.drawRadarGrid = function(svg, radarRadius, angleCalculator, coordG){
	var lines = svg.selectAll("line")
		.data(defaultConfig.data)
		.enter()
		.append("line")
		.attr("class", "radar-grid");

	lines
		.attr("x1",function(d,i){
			var ret = coordG(angleCalculator(i), defaultConfig.minRadius);
			d.gridLine.p0.x = ret.x;
			d.gridLine.p0.y = ret.y;
			return ret.x;
		}) // we also want to save the grid to the data as reference for d&d
		.attr("y1",function(d,i){return coordG(angleCalculator(i), defaultConfig.minRadius).y;})
		.attr("x2",function(d,i){
			var ret = coordG(angleCalculator(i), radarRadius);
			d.gridLine.p1.x = ret.x;
			d.gridLine.p1.y = ret.y;
			return ret.x;
		})
		.attr("y2",function(d,i){return coordG(angleCalculator(i), radarRadius).y;});
};

icoolhuntRadar.drawRadarPath = function(svg, radarRadius, angleCalculator, coordG, scale){
	var lineFunction = d3.svg.line()
		.x(function(d,i) { return coordG(angleCalculator(i), scale(d.value)).x;})
		.y(function(d,i) { return coordG(angleCalculator(i), scale(d.value)).y;})
		.interpolate(defaultConfig.radarPathInterpolation);

	svg.append("path")
		.attr("d", lineFunction(defaultConfig.data))
		.attr("stroke-width", 2)
		.attr("class", "radar-path");
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

	d.x = pointPosition.x;
	d.y = pointPosition.y;
	
	var distanceFromMin = Math.sqrt(dist2(d.gridLine.p0, d));
	
	var positionToValueScale = d3.scale.linear()
		.domain([0,d.defaultConfig.radarRadius]) //the input range is between 0 and radar radius
		.range([0, d.defaultConfig.maxValue]); //the output range is between 0 and the max value of the data //TODO maxValue should not be linked to max value of data
	d.value = positionToValueScale(distanceFromMin);
	
	d3.select(this)
		.attr("cx", d.x)
		.attr("cy", d.y);
	
};

//Draws the circles used to drag and drop values
icoolhuntRadar.drawRadarHandlers = function(svg, radarRadius, angleCalculator, coordG, scale){
	var dataCircles = svg.selectAll("circle")
	.data(defaultConfig.data)
	.enter()
	.append("circle")
	.attr("r", defaultConfig.radarHandlersRadius)
	.attr("class","radar-handlers");

	var drag = d3.behavior.drag()
	    .origin(function(d) { return d; })
	    .on("drag", icoolhuntRadar.dragmove);

	dataCircles
		.attr("cx",function(d,i){return coordG(angleCalculator(i), scale(d.value)).x;})
		.attr("cy",function(d,i){return coordG(angleCalculator(i), scale(d.value)).y;})
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


}(this));
