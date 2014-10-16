(function(root, undefined) {

  "use strict";


var defaultConfig = {
	width: '100px',
	height: '100px',
	radarHandlersRadius: 5, // the radius of the circles used to drag the values
	minRadius: 20 // the minimum radius from which the radar starts
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

	var svgCenter = {x:defaultConfig.width/2, y:defaultConfig.height/2}; //where should the center of our radar be?
	var maxValue = d3.max(defaultConfig.data.map(function(d){return d.value;})); //The max value found in our data

	var coordG = icoolhuntRadar.getPolarCoordGenerator(svgCenter,10,15);
  
	//radar Radius is half the minimum dimension of svg, less a margin which is due to the handles radius
	var radarRadius = (Math.min(defaultConfig.height,defaultConfig.width) / 2) - defaultConfig.radarHandlersRadius;

	var angleCalculator = icoolhuntRadar.equalAngleCalculator(defaultConfig.data.length, - Math.PI / 2);

	//Main scale definition
	var scale = d3.scale.linear()
		.domain([0, maxValue]) //the input range is between 0 and the max value found in data
		.range([defaultConfig.minRadius,radarRadius]); //the output range is between a minimum distance from the center (10) and radar radius

	//We draw the svg container
	var svg = d3.select(defaultConfig.element)
		.append("svg")
		.attr('width',defaultConfig.width)
		.attr('height',defaultConfig.height);

	//We draw the radar grid
	icoolhuntRadar.drawRadarGrid(svg, radarRadius, angleCalculator, coordG);

	//We draw the drag 'n drop handles
	icoolhuntRadar.drawRadarHandlers(svg, radarRadius, angleCalculator, coordG, scale);

	//We draw the radar path
	icoolhuntRadar.drawRadarPath(svg, radarRadius,angleCalculator,coordG,scale);

};

// Draws the radar grid
icoolhuntRadar.drawRadarGrid = function(svg, radarRadius, angleCalculator, coordG){
	var lines = svg.selectAll("line")
		.data(defaultConfig.data)
		.enter()
		.append("line")
		.attr("class", "radar-grid");

	lines
		.attr("x1",function(d,i){return coordG(angleCalculator(i), defaultConfig.minRadius).x;})
		.attr("y1",function(d,i){return coordG(angleCalculator(i), defaultConfig.minRadius).y;})
		.attr("x2",function(d,i){return coordG(angleCalculator(i), radarRadius).x;})
		.attr("y2",function(d,i){return coordG(angleCalculator(i), radarRadius).y;});
};

icoolhuntRadar.drawRadarPath = function(svg, radarRadius, angleCalculator, coordG, scale){
	var lineFunction = d3.svg.line()
		.x(function(d,i) { return coordG(angleCalculator(i), scale(d.value)).x;})
		.y(function(d,i) { return coordG(angleCalculator(i), scale(d.value)).y;})
		.interpolate("cardinal-closed");

	svg.append("path")
		.attr("d", lineFunction(defaultConfig.data))
		.attr("stroke", "rgba(80,120,150,0.5)")
		.attr("stroke-width", 2)
		.attr("fill", "rgba(100,150,180,0.5)");
};

//Draws the circles used to drag and drop values
icoolhuntRadar.drawRadarHandlers = function(svg, radarRadius, angleCalculator, coordG, scale){
	var dataCircles = svg.selectAll("circle")
	.data(defaultConfig.data)
	.enter()
	.append("circle")
	.attr("r", defaultConfig.radarHandlersRadius)
	.attr("class","radar-handlers");

	dataCircles
		.attr("cx",function(d,i){return coordG(angleCalculator(i), scale(d.value)).x;})
		.attr("cy",function(d,i){return coordG(angleCalculator(i), scale(d.value)).y;});
};

icoolhuntRadar.equalAngleCalculator = function(divider, angleOffset){
	return function(i){
		return (2 * Math.PI / divider) * i + angleOffset;
	};
};

icoolhuntRadar.getPolarCoordGenerator = function(origin){
	return function(angle, length){
		console.log({origin:origin, angle:angle, length:length});
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
