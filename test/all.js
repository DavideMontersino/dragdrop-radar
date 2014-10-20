d3 = function(){};
test("the base function exists", function() {
  ok(dragdropRadar);
});
test("another test",function(assert){
  var n = dragdropRadar({width:'300px'});
  assert.equal(dragdropRadar.getConfig().width,'300px');
});