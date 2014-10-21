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
	var $this = this;
	//we extend default configuration with the one passed by callee
	this.config = extend(defaultConfig, config);
	this.data = config.data;

	//We initialize dispatchers
	this.dispatchOnChange = d3.dispatch("change");

	this.config.svgCenter = {x:this.config.width/2, y:this.config.height/2}; //where should the center of our radar be?
	
	this.coordG = this.getPolarCoordGenerator(this.config.svgCenter);
  
	//radar Radius is half the minimum dimension of svg, less a margin which is due to the handles radius
	this.config.radarRadius = (Math.min(this.config.height,this.config.width) / 2) - this.config.radarHandlersRadius;

	this.angleCalculator = this.equalAngleCalculator(this.data.length, - Math.PI / 2);

	
	this.config.total = 0;
	this.config.maxFoundValue = 0;
	//add x,y coordinates to data: needed for d3's drag and drop
	this.data.forEach(function(element, index, array){
		array[index].i = index;
		array[index].gridLine = {p0:{x:0,y:0},p1:{x:0,p:0}}; // we create a container to save the radar segment to be used as a constraint when dragdropping handlers
		array[index].defaultConfig = $this.config;
		$this.config.total += element.value;
		if (element.value > $this.config.maxFoundValue){
			$this.config.maxFoundValue = element.value;
		}
	});

	this.config.maxValue = Math.max(this.config.maxValue, this.config.total);

	this.config.domainRange = this.config.zoomOnMaxValue ? [0,$this.config.maxFoundValue] : [0, $this.config.maxValue];
	//Main scale definition
	this.scale= d3.scale.pow().exponent(1/$this.config.exponent)
		.domain(this.config.domainRange) //the input range is between 0 and maxValue
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
dragdropRadar.prototype = {
	/*jshint validthis: true */
	VERSION: '0.0.0', // Version.

	change: function(name,func){
		this.dispatchOnChange.on(name,func);
	},
	//Draws the radial data labels
	drawDataLabels: function(){
		var $this = this;
		var dataLabels = this.svg.selectAll("text.data-labels")
			.data($this.data);

		dataLabels
			.enter()
			.append("text")
			.attr("class","data-labels");

		dataLabels
			.text(function(d){
				return d.name + (d.defaultConfig.showValuesOnLabels ? (" (" + d.value.toFixed($this.config.decimalValues) + $this.config.measureUnit + ")") : '');
			});
		
		if ($this.config.labelPosition === 'inner'){
			dataLabels
				.attr("transform", function(d,i) {
					var ret = $this.coordG($this.angleCalculator(i), $this.config.radarRadius - 100);
					return "translate(" + ret.x + "," + ret.y + ") rotate(" + $this.angleCalculator(i)* (180/Math.PI) +")";
			    })
			    .attr("dy",-4);
		} else {
			dataLabels
				.attr("transform", function(d,i){
					var ret = $this.coordG($this.angleCalculator(i), $this.config.radarRadius - 5);
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
				.text(function(d){return d.toFixed($this.config.decimalValues) + $this.config.measureUnit;})
				.attr("x", $this.config.svgCenter.x)
				.attr("y", function(d){return ($this.config.svgCenter.y - $this.scale(d) - $this.config.axeLabelsSpace);});
	},
	// Draws the radar grid
	drawRadarGrid: function(){
		var $this = this;

		$this.valueGrid = [];
		//The concentric grid
		if ($this.config.grid !== undefined && $this.config.grid > 0){
			$this.valueGrid = d3.range(0,$this.config.domainRange[1],($this.config.domainRange[1] /$this.config.grid));
		}

		$this.valueGrid.push($this.config.domainRange[1]);
		var concentricGrid = this.svg.selectAll("circle.radar-grid")
			.data($this.valueGrid);

		concentricGrid
			.enter()
			.append("circle")
			.attr("class", function(d){ return d === $this.config.domainRange[1] ? "radar-grid external-circle" : "radar-grid";});

		concentricGrid
			.attr("cx", $this.config.svgCenter.x)
			.attr("cy", $this.config.svgCenter.y)
			.attr("r", function(d){ return $this.scale(d);});
	
		if (this.config.showAxeLabels){
			this.drawAxeLabels();
		}
	
		
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
				// we do not want lines to get out of the radar
				ret = $this.coordG($this.angleCalculator(i), $this.config.radarRadius * (1 - $this.config.radarMargin));
				return ret.x;
			})
			.attr("y2",function(d,i){return $this.coordG($this.angleCalculator(i), $this.config.radarRadius * (1 - $this.config.radarMargin)).y;});

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
			.range(this.config.domainRange); //the output range is between 0 and the max value of the data
		
		var newVal = positionToValueScale(distanceFromMin);

		newVal = Math.min(newVal, $this.config.domainRange[1]); // we do not want our values to be greater than max value, of course!
		
		if (!isNaN(newVal)){
			if ($this.config.equalize){
			
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
			.data($this.data);

		dataCircles
			.enter()
			.append("circle")
			.attr("r", $this.config.radarHandlersRadius)
			.attr("class","radar-handlers");

		
		dataCircles
			.attr("cx",function(d,i){
				var ret = $this.coordG($this.angleCalculator(i), $this.scale(d.value));
				d.x = ret.x;
				d.y = ret.y;
				return ret.x;
			})
			.attr("cy",function(d,i){return $this.coordG($this.angleCalculator(i), $this.scale(d.value)).y;});

		if (this.config.editable){
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
			.data($this.data);

		tooltip.enter()
			.append("text")
			.attr("class", "radar-tooltip");

		tooltip
			.text(function(d){
				return d.name + (d.defaultConfig.showValuesOnTooltip ? (" (" + d.value.toFixed($this.config.decimalValues) + $this.config.measureUnit + ")") : '');
			})
			.attr("x", function(d,i){return $this.coordG($this.angleCalculator(i), $this.scale(d.value) + 5).x;})
			.attr("y", function(d,i){return $this.coordG($this.angleCalculator(i), $this.scale(d.value) + 5).y;})
			.attr("text-anchor", function(d,i) {
		        // are we past the center?
		        return Math.cos($this.angleCalculator(i)) < 0 ?
		            "end" : "start";
		    })
			.style("visibility", function(d,i){
				console.log({i:i, currentDataOver:$this.currentDataOver});
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
