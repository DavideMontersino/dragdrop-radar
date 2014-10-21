(function(root, undefined) {

  "use strict";


var defaultConfig = {
	width: '600',
	height: '400',
	radarHandlersRadius: 5, // the radius of the circles used to drag the values
	minRadius: 20, // the minimum radius from which the radar starts
	radarPathInterpolation: "linear-closed",
	maxValue: 100,
	radarMargin: 0.1, // how much margin from data max value and end of radar grid
	exponent: 2, // 1 to use a linear scale; otherwise, a pow() scale will be used
	grid: 0, //in how many sectors should grid be divided
	axeLabelsSpace: 2, // the space between axes text and the concentric grid circles
	equalize: true, //if true, changing one value will result in all other to decrease (and vice-versa), in order to mantain a constant sum
	showAxeLabels: true,
	labelPosition: 'outer', // inner or outer
	showValuesOnLabels: true,
	showValuesOnTooltip: true,
	measureUnit: "%", //measure unit to append to labels
	decimalValues: 0, // decimal values to be showed in labels
	editable: true,
	zoomOnMaxValue: false,
	element: '.radar'
};

/* global d3*/
/* dragdrop-radar main */

var extend = function(dst, src){
	var ret = [];
	for (var attrname in dst) { ret[attrname] = src[attrname] !== undefined ? src[attrname] :  dst[attrname]; }
	return ret;
};

// Base function.
function dragdropRadar(config) {
	/*jshint validthis: true */
	//we extend default configuration with the one passed by callee
	this._config = extend(defaultConfig, config);
	this._data = config.data;

	//We initialize dispatchers
	this.dispatchOnChange = d3.dispatch("change");
	
	this.redrawRadar();
}
dragdropRadar.prototype = {
	/*jshint validthis: true */
	VERSION: '0.0.0', // Version.

	config:function(key, value){
		if (arguments.length == 1){
			return this._config[key];
		}
		this._config[key] = value;
		return this;
	},
	data: function(data){
		if (arguments.length === 0){
			return this._data;
		}
		this._data = data;
	},
	change: function(name,func){
		this.dispatchOnChange.on(name,func);
	},
	redrawRadar: function(){
		var $this = this;

		this._config.svgCenter = {x:this._config.width/2, y:this._config.height/2}; //where should the center of our radar be?

		this.coordG = this.getPolarCoordGenerator(this._config.svgCenter);
		 
		//radar Radius is half the minimum dimension of svg, less a margin which is due to the handles radius
		this._config.radarRadius = (Math.min(this._config.height,this._config.width) / 2) - this._config.radarHandlersRadius;

		this.angleCalculator = this.equalAngleCalculator(this._data.length, - Math.PI / 2);

		
		this._config.total = 0;
		this._config.maxFoundValue = 0;
		//add x,y coordinates to data: needed for d3's drag and drop
		this._data.forEach(function(element, index, array){
			array[index].i = index;
			array[index].gridLine = {p0:{x:0,y:0},p1:{x:0,p:0}}; // we create a container to save the radar segment to be used as a constraint when dragdropping handlers
			array[index].defaultConfig = $this._config;
			$this._config.total += element.value;
			if (element.value > $this._config.maxFoundValue){
				$this._config.maxFoundValue = element.value;
			}
		});

		this._config.maxValue = Math.max(this._config.maxValue, this._config.total);

		this._config.domainRange = this._config.zoomOnMaxValue ? [0,$this._config.maxFoundValue] : [0, $this._config.maxValue];
		//Main scale definition
		this.scale= d3.scale.pow().exponent(1/$this._config.exponent)
			.domain(this._config.domainRange) //the input range is between 0 and maxValue
			.range([$this._config.minRadius,$this._config.radarRadius * (1 - $this._config.radarMargin)]); //the output range is between a minimum distance from the center (10) and radar radius

		//We draw the svg container
		if (this.svg === undefined){
			this.svg = d3.select($this._config.element)
				.append("svg");
		}
		
		this.svg
			.attr('width',$this._config.width)
			.attr('height',$this._config.height);

		//We draw the radar grid
		this.drawRadarGrid();

		//We draw the radar path
		this.drawRadarPath();

		//We draw the drag 'n drop handles
		this.drawRadarHandlers();

		return this;
	},
	//Draws the radial data labels
	drawDataLabels: function(){
		var $this = this;
		var dataLabels = this.svg.selectAll("text.data-labels")
			.data($this._data);

		dataLabels
			.enter()
			.append("text")
			.attr("class","data-labels");

		dataLabels
			.text(function(d){
				return d.name + (d.defaultConfig.showValuesOnLabels ? (" (" + d.value.toFixed($this._config.decimalValues) + $this._config.measureUnit + ")") : '');
			});
		
		if ($this._config.labelPosition === 'inner'){
			dataLabels
				.attr("transform", function(d,i) {
					var ret = $this.coordG($this.angleCalculator(i), $this._config.radarRadius - 100);
					return "translate(" + ret.x + "," + ret.y + ") rotate(" + $this.angleCalculator(i)* (180/Math.PI) +")";
			    })
			    .attr("dy",-4);
		} else {
			dataLabels
				.attr("transform", function(d,i){
					var ret = $this.coordG($this.angleCalculator(i), $this._config.radarRadius - 5);
					return "translate(" + ret.x + "," + ret.y + ")";
				})
				.attr("text-anchor", function(d,i) {
			        // are we past the center?
			        return Math.cos($this.angleCalculator(i)) < 0 ?
			            "end" : "start";
			    });
		}
		
	},
	// Draw the concentric grid's labels
	drawAxeLabels: function(){
			var $this = this;
			var axeLabels = this.svg.selectAll("text.axe-labels")
				.data($this.valueGrid);

			axeLabels
				.enter()
				.append("text")
				.attr("class","axe-labels");

			axeLabels
				.text(function(d){return d.toFixed($this._config.decimalValues) + $this._config.measureUnit;})
				.attr("x", $this._config.svgCenter.x)
				.attr("y", function(d){return ($this._config.svgCenter.y - $this.scale(d) - $this._config.axeLabelsSpace);});
	},
	// Draws the radar grid
	drawRadarGrid: function(){
		var $this = this;

		$this.valueGrid = [];
		//The concentric grid
		if ($this._config.grid !== undefined && $this._config.grid > 0){
			$this.valueGrid = d3.range(0,$this._config.domainRange[1],($this._config.domainRange[1] /$this._config.grid));
		}

		$this.valueGrid.push($this._config.domainRange[1]);
		var concentricGrid = this.svg.selectAll("circle.radar-grid")
			.data($this.valueGrid);

		concentricGrid
			.enter()
			.append("circle")
			.attr("class", function(d){ return d === $this._config.domainRange[1] ? "radar-grid external-circle" : "radar-grid";});

		concentricGrid
			.attr("cx", $this._config.svgCenter.x)
			.attr("cy", $this._config.svgCenter.y)
			.attr("r", function(d){ return $this.scale(d);});
	
		concentricGrid
			.exit()
			.remove();

		if (this._config.showAxeLabels){
			this.drawAxeLabels();
		}
	
		
		// one line for each value
		var lines = this.svg.selectAll("line")
			.data($this._data);

		lines
			.enter()
			.append("line")
			.attr("class", "radar-grid");

		lines
			.attr("x1",function(d,i){
				var ret = $this.coordG($this.angleCalculator(i), $this._config.minRadius);
				d.gridLine.p0.x = ret.x;
				d.gridLine.p0.y = ret.y;
				return ret.x;
			}) // we also want to save the grid to the data as reference for d&d
			.attr("y1",function(d,i){return $this.coordG($this.angleCalculator(i), $this._config.minRadius).y;})
			.attr("x2",function(d,i){
				var ret = $this.coordG($this.angleCalculator(i), d.defaultConfig.radarRadius);
				d.gridLine.p1.x = ret.x;
				d.gridLine.p1.y = ret.y;
				// we do not want lines to get out of the radar
				ret = $this.coordG($this.angleCalculator(i), $this._config.radarRadius * (1 - $this._config.radarMargin));
				return ret.x;
			})
			.attr("y2",function(d,i){return $this.coordG($this.angleCalculator(i), $this._config.radarRadius * (1 - $this._config.radarMargin)).y;});

		lines
			.exit()
			.remove();
		this.drawDataLabels();

	},
	drawRadarPath: function(){
		var $this = this;
		var lineFunction = d3.svg.line()
			.x(function(d,i) { return $this.coordG($this.angleCalculator(i), $this.scale(d.value)).x;})
			.y(function(d,i) { return $this.coordG($this.angleCalculator(i), $this.scale(d.value)).y;})
			.interpolate($this._config.radarPathInterpolation);

		var path = this.svg.selectAll("path")
			.data([$this._data]);

		path
			.enter()
			.append("path")
			.attr("stroke-width", 2)
			.attr("class", "radar-path");

		path
			.attr("d", lineFunction($this._data));
			
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
		
		var positionToValueScale = d3.scale.pow().exponent($this._config.exponent)
			.domain([0,$this._config.radarRadius * (1 - $this._config.radarMargin)]) //the input range is between 0 and radar radius
			.range(this._config.domainRange); //the output range is between 0 and the max value of the data
		
		var newVal = positionToValueScale(distanceFromMin);

		newVal = Math.min(newVal, $this._config.domainRange[1]); // we do not want our values to be greater than max value, of course!
		
		if (!isNaN(newVal)){
			if ($this._config.equalize){
			
				var difference = d.value - newVal, // how much we have to redistribute to other values
				toDistribute = difference / (d.defaultConfig.total - d.value);

				var newTotal = 0;
				$this._data.forEach(function(element,index){
					if(d.i !== index){
						element.value += toDistribute * element.value;
					}
					newTotal += element.value;
				});
				
				newTotal = newTotal - d.value + newVal;
				
				//are we drifting away from the starting total? let's correct it:
				var error = newTotal - $this._config.total;
				d.value = newVal - error;
			} else {
				d.value = newVal;
			}
		}
		
		$this.dispatchOnChange.change.apply(d);
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
			.data($this._data);

		dataCircles
			.enter()
			.append("circle")
			.attr("r", $this._config.radarHandlersRadius)
			.attr("class","radar-handlers");

		
		dataCircles
			.attr("cx",function(d,i){
				var ret = $this.coordG($this.angleCalculator(i), $this.scale(d.value));
				d.x = ret.x;
				d.y = ret.y;
				return ret.x;
			})
			.attr("cy",function(d,i){return $this.coordG($this.angleCalculator(i), $this.scale(d.value)).y;});

		if (this._config.editable){
			var drag = d3.behavior.drag()
			    .origin(function(d) { return d; })
			    .on("drag", function(d) {$this.dragmove(d,$this);});

			dataCircles
				.call(drag);
		}

		dataCircles.on("mouseover", function(d){
			d.tooltip = 'visible';
			$this.drawRadarHandlers();
		});
		dataCircles.on("mouseout", function(d){
			d.tooltip = 'none';
			$this.drawRadarHandlers();
		});

		var tooltip = this.svg.selectAll("text.radar-tooltip")
			.data($this._data);

		tooltip.enter()
			.append("text")
			.attr("class", "radar-tooltip");

		tooltip
			.text(function(d){
				return d.name + (d.defaultConfig.showValuesOnTooltip ? (" (" + d.value.toFixed($this._config.decimalValues) + $this._config.measureUnit + ")") : '');
			})
			.attr("x", function(d,i){return $this.coordG($this.angleCalculator(i), $this.scale(d.value) + 5).x;})
			.attr("y", function(d,i){return $this.coordG($this.angleCalculator(i), $this.scale(d.value) + 5).y;})
			.attr("text-anchor", function(d,i) {
		        // are we past the center?
		        return Math.cos($this.angleCalculator(i)) < 0 ?
		            "end" : "start";
		    })
			.style("visibility", function(d,i){
				if(d.tooltip === "visible"){
					return "visible";
				}
				return "hidden";
			});
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
root.dragdropRadar = dragdropRadar;


}(this));
