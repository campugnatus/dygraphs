/**
 * @license
 * Copyright 2012 Dan Vanderkam (danvdk@gmail.com)
 * MIT-licensed (http://opensource.org/licenses/MIT)
 */

/*global Dygraph:false */

'use strict';

/*
Bits of jankiness:
- Direct layout access
- Direct area access
- Should include calculation of ticks, not just the drawing.

Options left to make axis-friendly.
  ('drawAxesAtZero')
  ('xAxisHeight')
*/

import * as utils from '../dygraph-utils';

/**
 * Draws the axes. This includes the labels on the x- and y-axes, as well
 * as the tick marks on the axes.
 * It does _not_ draw the grid lines which span the entire chart.
 */
var axes = function() {
  this.labels = {
    x: [],
    y: [],
    y2: []
  };

  this.labelsUsed = {
    x: 0,
    y: 0,
    y2: 0
  };
};

axes.prototype.toString = function() {
  return 'Axes Plugin';
};

axes.prototype.activate = function(g) {
  return {
    layout: this.layout,
    clearChart: this.clearChart,
    willDrawChart: this.willDrawChart
  };
};

axes.prototype.layout = function(e) {
  var g = e.dygraph;

  if (g.getOptionForAxis('drawAxis', 'y')) {
    var w = g.getOptionForAxis('axisLabelWidth', 'y') + 2 * g.getOptionForAxis('axisTickSize', 'y');
    e.reserveSpaceLeft(w);
  }

  if (g.getOptionForAxis('drawAxis', 'x')) {
    var h;
    // NOTE: I think this is probably broken now, since g.getOption() now
    // hits the dictionary. (That is, g.getOption('xAxisHeight') now always
    // has a value.)
    if (g.getOption('xAxisHeight')) {
      h = g.getOption('xAxisHeight');
    } else {
      h = g.getOptionForAxis('axisLabelFontSize', 'x') + 2 * g.getOptionForAxis('axisTickSize', 'x');
    }
    e.reserveSpaceBottom(h);
  }

  if (g.numAxes() == 2) {
    if (g.getOptionForAxis('drawAxis', 'y2')) {
      var w = g.getOptionForAxis('axisLabelWidth', 'y2') + 2 * g.getOptionForAxis('axisTickSize', 'y2');
      e.reserveSpaceRight(w);
    }
  } else if (g.numAxes() > 2) {
    g.error('Only two y-axes are supported at this time. (Trying ' +
            'to use ' + g.numAxes() + ')');
  }
};

axes.prototype.detachLabels = function() {
  this.labelsUsed.x = 0;
  this.labelsUsed.y = 0;
  this.labelsUsed.y2 = 0;
};

axes.prototype.clearChart = function(e) {
  this.detachLabels();
};

axes.prototype.getDiv = function(axis) {
  if (this.labelsUsed[axis] < this.labels[axis].length) {
    return this.labels[axis][this.labelsUsed[axis]++];
  } else {
    return null;
  }
}

axes.prototype.updateDiv = function(div, axis, label, g) {
  // dygraph options can change at any moment, so we have to fetch and apply
  // them every frame

  div.style.fontSize = g.getOptionForAxis('axisLabelFontSize', axis) + 'px';
  div.width = g.getOptionForAxis('axisLabelWidth', axis) + 'px';
  div.style.display = "block";
  div.innerText = label;
};

axes.prototype.hideUnused = function(axis) {
  var label;
  while (label = this.getDiv(axis)) {
    label.style.display = "none";
  }
}

axes.prototype.makeDiv = function(axis, container) {
  // axis can be: x, y, y2
  var div = document.createElement('div');
  div.style.position = 'absolute';

  div.className += ' dygraph-axis-label';
  if (axis !== 'x') {
    div.className += ' dygraph-axis-label-' + axis;
  }

  if (axis === 'x') {
    div.style.textAlign = 'center';
  }

  container.appendChild(div);
  this.labels[axis].push(div);
  this.labelsUsed[axis]++;

  return div;
};

axes.prototype.willDrawChart = function(e) {
  var g = e.dygraph;

  if (!g.getOptionForAxis('drawAxis', 'x') &&
      !g.getOptionForAxis('drawAxis', 'y') &&
      !g.getOptionForAxis('drawAxis', 'y2')) {
    return;
  }

  // Round pixels to half-integer boundaries for crisper drawing.
  function halfUp(x)  { return Math.round(x) + 0.5; }
  function halfDown(y){ return Math.round(y) - 0.5; }

  var context = e.drawingContext;
  var containerDiv = e.canvas.parentNode;
  var canvasWidth = g.width_;  // e.canvas.width is affected by pixel ratio.
  var canvasHeight = g.height_;

  // axis lines
  context.save();

  var layout = g.layout_;
  var area = e.dygraph.plotter_.area;

  // Helper for repeated axis-option accesses.
  var makeOptionGetter = function(axis) {
    return function(option) {
      return g.getOptionForAxis(option, axis);
    };
  };

  if (g.getOptionForAxis('drawAxis', 'y')) {
    if (layout.yticks && layout.yticks.length > 0) {
      var num_axes = g.numAxes();
      var getOptions = [makeOptionGetter('y'), makeOptionGetter('y2')];
      layout.yticks.forEach(tick => {
        if (tick.label === undefined) return;  // this tick only has a grid line.
        var x = area.x;
        var sgn = 1;
        var axis = 'y';
        var getAxisOption = getOptions[0];
        if (tick.axis == 1) {  // right-side y-axis
          x = area.x + area.w;
          sgn = -1;
          axis = 'y2';
          getAxisOption = getOptions[1];
        }
        var fontSize = getAxisOption('axisLabelFontSize');
        var y = area.y + tick.pos * area.h;

        /* Tick marks are currently clipped, so don't bother drawing them.
        context.beginPath();
        context.moveTo(halfUp(x), halfDown(y));
        context.lineTo(halfUp(x - sgn * this.attr_('axisTickSize')), halfDown(y));
        context.closePath();
        context.stroke();
        */

        var label = this.getDiv(axis) || this.makeDiv(axis, containerDiv);
        this.updateDiv(label, axis, tick.label, g);

        var top = (y - fontSize / 2);
        if (top < 0) top = 0;

        if (top + fontSize + 3 > canvasHeight) {
          label.style.bottom = '0';
        } else {
          label.style.top = top + 'px';
        }
        // TODO: replace these with css classes?
        if (tick.axis === 0) {
          label.style.left = (area.x - getAxisOption('axisLabelWidth') - getAxisOption('axisTickSize')) + 'px';
          label.style.textAlign = 'right';
        } else if (tick.axis == 1) {
          label.style.left = (area.x + area.w +
                              getAxisOption('axisTickSize')) + 'px';
          label.style.textAlign = 'left';
        }
      });

      // The lowest tick on the y-axis often overlaps with the leftmost
      // tick on the x-axis. Shift the bottom tick up a little bit to
      // compensate if necessary.
      var bottomTick = this.labels.y[0];
      // Interested in the y2 axis also?
      var fontSize = g.getOptionForAxis('axisLabelFontSize', 'y');
      var bottom = parseInt(bottomTick.style.top, 10) + fontSize;
      if (bottom > canvasHeight - fontSize) {
        bottomTick.style.top = (parseInt(bottomTick.style.top, 10) -
            fontSize / 2) + 'px';
      }
    }

    // draw a vertical line on the left to separate the chart from the labels.
    var axisX;
    if (g.getOption('drawAxesAtZero')) {
      var r = g.toPercentXCoord(0);
      if (r > 1 || r < 0 || isNaN(r)) r = 0;
      axisX = halfUp(area.x + r * area.w);
    } else {
      axisX = halfUp(area.x);
    }

    context.strokeStyle = g.getOptionForAxis('axisLineColor', 'y');
    context.lineWidth = g.getOptionForAxis('axisLineWidth', 'y');

    context.beginPath();
    context.moveTo(axisX, halfDown(area.y));
    context.lineTo(axisX, halfDown(area.y + area.h));
    context.closePath();
    context.stroke();

    // if there's a secondary y-axis, draw a vertical line for that, too.
    if (g.numAxes() == 2) {
      context.strokeStyle = g.getOptionForAxis('axisLineColor', 'y2');
      context.lineWidth = g.getOptionForAxis('axisLineWidth', 'y2');
      context.beginPath();
      context.moveTo(halfDown(area.x + area.w), halfDown(area.y));
      context.lineTo(halfDown(area.x + area.w), halfDown(area.y + area.h));
      context.closePath();
      context.stroke();
    }
  }

  if (g.getOptionForAxis('drawAxis', 'x')) {
    if (layout.xticks) {
      var getAxisOption = makeOptionGetter('x');
      layout.xticks.forEach(tick => {
        if (tick.label === undefined) return;  // this tick only has a grid line.
        var x = area.x + tick.pos * area.w;
        var y = area.y + area.h;

        /* Tick marks are currently clipped, so don't bother drawing them.
        context.beginPath();
        context.moveTo(halfUp(x), halfDown(y));
        context.lineTo(halfUp(x), halfDown(y + this.attr_('axisTickSize')));
        context.closePath();
        context.stroke();
        */

        var axisLabelWidth = getAxisOption('axisLabelWidth');

        var label = this.getDiv('x') || this.makeDiv('x', containerDiv);
        this.updateDiv(label, 'x', tick.label, g);

        var left = (x - axisLabelWidth/2);
        if (left + axisLabelWidth > canvasWidth) {
          left = canvasWidth - axisLabelWidth;
          label.style.textAlign = 'right';
        }
        if (left < 0) {
          left = 0;
          label.style.textAlign = 'left';
        }

        label.style.left = left + 'px';
        label.style.top = (y + getAxisOption('axisTickSize')) + 'px';
      });
    }

    context.strokeStyle = g.getOptionForAxis('axisLineColor', 'x');
    context.lineWidth = g.getOptionForAxis('axisLineWidth', 'x');
    context.beginPath();
    var axisY;
    if (g.getOption('drawAxesAtZero')) {
      var r = g.toPercentYCoord(0, 0);
      if (r > 1 || r < 0) r = 1;
      axisY = halfDown(area.y + r * area.h);
    } else {
      axisY = halfDown(area.y + area.h);
    }
    context.moveTo(halfUp(area.x), axisY);
    context.lineTo(halfUp(area.x + area.w), axisY);
    context.closePath();
    context.stroke();
  }

  this.hideUnused('x');
  this.hideUnused('y');
  this.hideUnused('y2');

  context.restore();
};

export default axes;
