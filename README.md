# icoolhunt-radar

*this is in early Alpha stage!*

Everything still needs to be done

A radar graph widget that can be used to input values too.

## About

A JavaScript library by Davide Orazio Montersino.

See the [project homepage](http://DavideMontersino.github.io/icoolhunt-radar).

## Installation

Using Bower:

    bower install icoolhunt-radar

Or grab the [source](https://github.com/DavideMontersino/icoolhunt-radar/dist/icoolhunt-radar.js) ([minified](https://github.com/DavideMontersino/icoolhunt-radar/dist/icoolhunt-radar.min.js)).

## Usage

Basic usage is as follows:

###Html
    <body>
        <div id="myRadar"></div>
        <script type="text/javascript">
            var myRadar = new iCoolhuntRadar({
                element: "#myRadar",
                data: [
                    {value: 18, name: 'first'},
                    {value: 3, name: 'second'},
                    {value: 2, name: 'third'}]
                });
        </script>
    </body>

## Documentation

Start with `docs/MAIN.md`.

## Contributing

We'll check out your contribution if you:

* Provide a comprehensive suite of tests for your fork.
* Have a clear and documented rationale for your changes.
* Package these up in a pull request.

We'll do our best to help you out with any contribution issues you may have.

## License

MIT. See `LICENSE.txt` in this directory.
