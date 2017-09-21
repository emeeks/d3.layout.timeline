import { min, max } from "d3-array";
import { scaleLinear } from "d3-scale";

module.exports = function() {
  let timelines = [];
  let dateAccessor = function(d) {
    return new Date(d);
  };
  let processedTimelines = [];
  let startAccessor = function(d) {
    return d.start;
  };
  let endAccessor = function(d) {
    return d.end;
  };
  let size = [500, 100];
  let timelineExtent = [-Infinity, Infinity];
  let setExtent = [];
  let displayScale = scaleLinear();
  let swimlanes = { root: [] };
  let swimlaneNumber = 1;
  let padding = 0;
  let fixedExtent = false;
  let maximumHeight = Infinity;
  let childAccessor = function(d) {
    return null;
  };
  let bandID = 1;
  let projectedHierarchy = { id: "root", values: [] };

  function processTimelines(timelines, parentBand) {
    if (!Array.isArray(timelines) && Array.isArray(childAccessor(timelines))) {
      let rootnode = { id: 0, level: 0 };
      for (let x in timelines) {
        if (timelines.hasOwnProperty(x)) {
          rootnode[x] = timelines[x];
        }
      }
      rootnode.id = 0;
      rootnode.level = 0;
      rootnode.values = [];
      projectedHierarchy = rootnode;
      processTimelines(childAccessor(timelines), rootnode);
      rootnode.start = min(rootnode.values, function(d) {
        return d.start;
      });
      rootnode.end = max(rootnode.values, function(d) {
        return d.end;
      });
      processedTimelines.push(rootnode);

      return;
    }

    timelines.forEach(function(band) {
      let projectedBand = { level: 0, id: bandID };

      if (parentBand !== undefined) {
        projectedBand.parent = parentBand;
      }
      bandID++;

      for (let x in band) {
        if (band.hasOwnProperty(x)) {
          projectedBand[x] = band[x];
        }
      }

      if (Array.isArray(childAccessor(band))) {
        processTimelines(childAccessor(band), projectedBand);
        projectedBand.start = min(projectedBand.values, function(d) {
          return d.start;
        });
        projectedBand.end = max(projectedBand.values, function(d) {
          return d.end;
        });
      } else {
        projectedBand.start = dateAccessor(startAccessor(band));
        projectedBand.end = dateAccessor(endAccessor(band));
      }

      projectedBand.lane = 0;
      processedTimelines.push(projectedBand);
      if (parentBand) {
        if (!parentBand.values) {
          parentBand.values = [];
        }
        parentBand.values.push(projectedBand);
      }
      if (parentBand === undefined) {
        projectedHierarchy.values.push(projectedBand);
      }
    });
  }

  function projectTimelines() {
    if (fixedExtent === false) {
      let minStart = min(processedTimelines, function(d) {
        return d.start;
      });
      let maxEnd = max(processedTimelines, function(d) {
        return d.end;
      });
      timelineExtent = [minStart, maxEnd];
    } else {
      timelineExtent = [dateAccessor(setExtent[0]), dateAccessor(setExtent[1])];
    }

    displayScale.domain(timelineExtent).range([0, size[0]]);

    processedTimelines.forEach(function(band) {
      band.originalStart = band.start;
      band.originalEnd = band.end;
      band.start = displayScale(band.start);
      band.end = displayScale(band.end);
    });
  }

  function fitsIn(lane, band) {
    if (lane.end < band.start || lane.start > band.end) {
      return true;
    }
    let filteredLane = lane.filter(function(d) {
      return d.start <= band.end && d.end >= band.start;
    });
    if (filteredLane.length === 0) {
      return true;
    }
    return false;
  }

  function findlane(band) {
    //make the first array
    let swimlane = swimlanes["root"];
    if (band.parent) {
      swimlane = swimlanes[band.parent.id];
    }

    if (swimlane === undefined) {
      swimlanes[band.parent.id] = [[band]];
      swimlane = swimlanes[band.parent.id];
      swimlaneNumber++;
      return;
    }
    let l = swimlane.length - 1;
    let x = 0;

    while (x <= l) {
      if (fitsIn(swimlane[x], band)) {
        swimlane[x].push(band);
        return;
      }
      x++;
    }
    swimlane[x] = [band];
    return;
  }

  function timeline(data) {
    if (!arguments.length) return timeline;

    projectedHierarchy = { id: "root", values: [] };

    processedTimelines = [];
    swimlanes = { root: [] };

    processTimelines(data);
    projectTimelines(data);

    processedTimelines.forEach(function(band) {
      findlane(band);
    });

    for (let x in swimlanes) {
      swimlanes[x].forEach(function(lane, i) {
        let height = size[1] / swimlanes[x].length;
        height = Math.min(height, maximumHeight);
        lane.forEach(function(band) {
          band.y = i * height + padding / 2;
          band.dy = height - padding;
          band.lane = i;
          band.dyp = 1 / swimlanes[x].length;
        });
      });
    }

    projectedHierarchy.values.forEach(relativePosition);

    processedTimelines.sort(function(a, b) {
      if (a.level > b.level) {
        return 1;
      }
      if (a.level < b.level) {
        return -1;
      }
      return 1;
    });

    return processedTimelines;
  }

  function relativePosition(band, i) {
    if (!band.parent) {
      band.level = 0;
    } else {
      band.level = band.parent.level + 1;
      let height = band.dyp * band.parent.dy;
      band.y = band.parent.y + band.lane * height + padding / 2;
      band.dy = Math.max(1, height - padding);
    }
    if (band.values) {
      band.values.forEach(relativePosition);
    }
  }

  timeline.childAccessor = function(_x) {
    if (!arguments.length) return childAccessor;
    childAccessor = _x;
    return timeline;
  };

  timeline.dateFormat = function(_x) {
    if (!arguments.length) return dateAccessor;
    dateAccessor = _x;
    return timeline;
  };

  timeline.bandStart = function(_x) {
    if (!arguments.length) return startAccessor;
    startAccessor = _x;
    return timeline;
  };

  timeline.bandEnd = function(_x) {
    if (!arguments.length) return endAccessor;
    endAccessor = _x;
    return timeline;
  };

  timeline.size = function(_x) {
    if (!arguments.length) return size;
    size = _x;
    return timeline;
  };

  timeline.padding = function(_x) {
    if (!arguments.length) return padding;
    padding = _x;
    return timeline;
  };

  timeline.extent = function(_x) {
    if (!arguments.length) return timelineExtent;
    fixedExtent = true;
    setExtent = _x;
    if (_x.length === 0) {
      fixedExtent = false;
    }
    return timeline;
  };

  timeline.maxBandHeight = function(_x) {
    if (!arguments.length) return maximumHeight;
    maximumHeight = _x;
    return timeline;
  };

  return timeline;
};
