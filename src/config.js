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
	equalize: false //if true, changing one value will result in all other to decrease (and vice-versa), in order to mantain a constant sum
};