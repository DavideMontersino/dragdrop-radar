## Usage

Basic usage is as follows:

    <body>
        <div id="myRadar"></div>
        <script type="text/javascript">
            var myRadar = new dragdropRadar({
                element: "#myRadar",
                data: [
                    {value: 18, name: 'first'},
                    {value: 3, name: 'second'},
                    {value: 2, name: 'third'}]
                });
        </script>
    </body>

## Options

###width  
default: 100px

###height
default: 100px

###radarHandlersRadius 
default:5px
The radius of the circles used to drag the values

###minRadius  
default: 20px
The radius from which the radar starts

###radarPathInterpolation  
default: "linear-closed" 
All the values specified as path generators in https://www.dashingd3js.com/svg-paths-and-d3js are valid, but only some look good (i.e cardinal-closed)

###maxValue
default: 100
The max value that values can have.

###radarMargin
defaults: 0.1
how much margin from data max value and end of radar grid; 0.1 stands for 10%.

###exponent 
defaults: 2
Use 1 to use a linear scale; otherwise, a pow() scale will be used with that exponent.

###grid
default: 10
In how many sectors should grid be divided

###axeLabelsSpace
default: 2
the space between axes text and the concentric grid circles

###equalize
default: true
if true, changing one value will result in all other to decrease (and vice-versa), in order to mantain a constant sum

###element
default: .radar
The element that will containt the radar's svg

###showAxeLabels
default: true

###measureunit
default: "%"
measure unit to append to labels.

##showValuesOnLabels
default: true
if true, dataset name labels will also contain show the value (and measure unit)

###showValuesOnTooltip
default: true
if true, dataset tooltips will also contain show the value (and measure unit)

###decimalValues
default: 0
decimal values to be showed in labels

###editable
default: true
If false, drag and drop behaviour is disabled

###zoomOnMaxValue
default: false
If true, radar is zoomed-in to the max value found in dataset.

###labelPosition
default: outer
Should the data labels be outside or inside the radar?

#Events
You can hook to the event 'change' of an instance of radar; the context in which the function will run is the context of the value that is changing
    
    n2.change("change", function(){
        //do your stuff here
    });