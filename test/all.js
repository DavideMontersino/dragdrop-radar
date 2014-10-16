d3 = function(){};
test("the base function exists", function() {
  ok(icoolhuntRadar);
});
test("another test",function(assert){
  var n = icoolhuntRadar({width:'300px'});
  assert.equal(icoolhuntRadar.getConfig().width,'300px');
});