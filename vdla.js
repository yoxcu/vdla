var units = ["°C", "A", "A", "%", "km/h", "V", "Ah", "Ah", "Wh", "Wh", "km", "W", "m", "km/h"]
var axes_names = units.filter(function (item, pos, self) {
  return self.indexOf(item) == pos;
})
var colors = ["red", "purple", "green", "lime", "navy", "blue", "orange", "cyan", "darkcyan", "olive", "yellow", "teal", "maroon", "fuchsia"]
var fill = ["rgba(255, 0, 0, 0.3)", "rgba(128, 0, 128, 0.3)", "rgba(0, 128, 0, 0.3)", "rgba(0, 255, 0, 0.3)", "rgba(0, 0, 128, 0.3)", "rgba(0, 0, 255, 0.3)", "rgba(255, 165, 0, 0.3)", "rgba(0, 255, 255, 0.3)", "rgba(0, 139, 139, 0.3)", "rgba(128, 128, 0, 0.3)", "rgba(255, 255, 0, 0.3)", "rgba(0, 128, 128, 0.3)", "rgba(128, 0, 0, 0.3)", "rgba(255, 0, 255, 0.3)"]
var series_shown = [true, false, true, true, true, true, false, false, false, false, false, true, false, false];
var Times = [];
var TempPcbs = [];
var MotorCurrents = [];
var BatteryCurrents = [];
var DutyCycles = [];
var Speeds = [];
var InpVoltages = [];
var AmpHours = [];
var AmpHoursCharged = [];
var WattHours = [];
var WattHoursCharged = [];
var Distances = [];
var Powers = [];
var Faults = [];
var TimePassedInMss = [];
var latlngs = [];
var Altitudes = [];
var GPSSpeeds = [];
var names = [];
var data = [];
var curr_plot_indx = 0;
var curr_map_indx = 0;
var map;
var uplot;
var menu_visible = false;
var map_popup;

//uplot plugins
function touchZoomPlugin(opts) {
  function init(u, opts, data) {
    let plot = u.root.querySelector(".over");
    let rect, oxRange, oyRange, xVal, yVal;
    let fr = { x: 0, y: 0, dx: 0, dy: 0 };
    let to = { x: 0, y: 0, dx: 0, dy: 0 };

    function storePos(t, e) {
      let ts = e.touches;

      let t0 = ts[0];
      let t0x = t0.clientX - rect.left;
      let t0y = t0.clientY - rect.top;

      if (ts.length == 1) {
        t.x = t0x;
        t.y = t0y;
        t.d = 0;
      }
      else {
        let t1 = e.touches[1];
        let t1x = t1.clientX - rect.left;
        let t1y = t1.clientY - rect.top;

        let xMin = Math.min(t0x, t1x);
        let yMin = Math.min(t0y, t1y);
        let xMax = Math.max(t0x, t1x);
        let yMax = Math.max(t0y, t1y);

        // midpts
        t.y = (yMin + yMax) / 2;
        t.x = (xMin + xMax) / 2;

        t.dx = xMax - xMin;
        t.dy = yMax - yMin;

        // dist
        t.d = Math.sqrt(t.dx * t.dx + t.dy * t.dy);
      }
    }

    let rafPending = false;

    function zoom() {
      rafPending = false;

      let left = to.x;
      let top = to.y;

      // non-uniform scaling
      //	let xFactor = fr.dx / to.dx;
      //	let yFactor = fr.dy / to.dy;

      // uniform x/y scaling
      let xFactor = fr.d / to.d;
      let yFactor = fr.d / to.d;

      let leftPct = left / rect.width;
      let btmPct = 1 - top / rect.height;

      let nxRange = oxRange * xFactor;
      let nxMin = xVal - leftPct * nxRange;
      let nxMax = nxMin + nxRange;

      let nyRange = oyRange * yFactor;
      let nyMin = yVal - btmPct * nyRange;
      let nyMax = nyMin + nyRange;

      u.batch(() => {
        u.setScale("x", {
          min: nxMin,
          max: nxMax,
        });

        u.setScale("y", {
          min: nyMin,
          max: nyMax,
        });
      });
    }

    function touchmove(e) {
      storePos(to, e);

      if (!rafPending) {
        rafPending = true;
        requestAnimationFrame(zoom);
      }
    }

    plot.addEventListener("touchstart", function (e) {
      rect = plot.getBoundingClientRect();

      storePos(fr, e);

      oxRange = u.scales.x.max - u.scales.x.min;
      oyRange = u.scales.y.max - u.scales.y.min;

      let left = fr.x;
      let top = fr.y;

      xVal = u.posToVal(left, "x");
      yVal = u.posToVal(top, "y");

      document.addEventListener("touchmove", touchmove, { passive: true });
    });

    plot.addEventListener("touchend", function (e) {
      document.removeEventListener("touchmove", touchmove, { passive: true });
    });
  }

  return {
    hooks: {
      init
    }
  };
}

//utils

function compare_filetimes(a, b) {
  if (a.time > b.time) return 1;
  if (b.time > a.time) return -1;

  return 0;
}

function getAllIndexes(arr, val) {
  var indexes = [], i;
  for (i = 0; i < arr.length; i++)
    if (arr[i] === val)
      indexes.push(i);
  return indexes;
}

function handleError(txt) {
  var span = document.createElement('span');
  span.innerHTML = txt;
  document.getElementById("loader_sec").appendChild(span)
  show_loader()
}

function get_Log(url) {
  // read text from URL location
  var request = new XMLHttpRequest();
  request.open('GET', url, true);
  request.send(null);
  request.onreadystatechange = function () {
    if (request.readyState === 4) {
      if (request.status === 200) {
        var type = request.getResponseHeader('Content-Type');
        if (type.indexOf("text") !== 1) {
          parse_LogFile(request.responseText)
        }
      } else {
        handleError("Error Fetching Log: " + request.status + " " + request.statusText)
      }
    }
  }
}

function print_data() {
  console.log(names);
  console.log(data);
}

function throttle(cb, limit) {
  var wait = false;
  return () => {
    if (!wait) {
      requestAnimationFrame(cb);
      wait = true;
      setTimeout(() => {
        wait = false;
      }, limit);
    }
  }
}

function show_upload() {
  console.log("Showing Upload section");
  document.getElementById("loader_sec").style.visibility = "hidden";
  document.getElementById("content_sec").style.visibility = "hidden";
  document.getElementById("upload_sec").style.visibility = "visible";
}

function show_loader() {
  console.log("Showing Loader section");
  document.getElementById("loader_sec").style.visibility = "visible";
  document.getElementById("content_sec").style.visibility = "hidden";
  document.getElementById("upload_sec").style.visibility = "hidden";
}

function show_content() {
  console.log("Showing Content section");
  document.getElementById("loader_sec").style.visibility = "hidden";
  document.getElementById("content_sec").style.visibility = "visible";
  document.getElementById("upload_sec").style.visibility = "hidden";
}

function menu_click(e) {
  e.classList.toggle("change");
  if (menu_visible) {
    document.getElementById("menu_list").style.visibility = "hidden";
    menu_visible = false;
  } else {
    document.getElementById("menu_list").style.visibility = "visible";
    menu_visible = true;
  }
}

function cb_change(e) {
  if (event.target.checked) {
    var i = names.indexOf(e.target.id.substr(3))
    uplot.setSeries((i + 1), { show: true })
    series_shown[i] = true;
  } else {
    var i = names.indexOf(e.target.id.substr(3))
    uplot.setSeries((i + 1), { show: false })
    series_shown[i] = false;
  }
}

function fill_menu() {
  for (var i in names) {
    i = parseInt(i);
    var li = document.createElement('li');

    var checkbox = document.createElement('input');
    checkbox.type = "checkbox";
    checkbox.id = "cb_" + names[i];
    checkbox.addEventListener('change', cb_change);

    var label = document.createElement('label')
    label.htmlFor = "cb_" + names[i];
    label.appendChild(document.createTextNode(names[i]));

    li.appendChild(checkbox);
    li.appendChild(label);
    document.getElementById('menu_list').appendChild(li);
    if (series_shown[i]) {
      checkbox.checked = true;
      uplot.setSeries((i + 1), { show: true })
    } else {
      checkbox.checked = false;
      uplot.setSeries((i + 1), { show: false });
    }
  }
}

function find_closest_ind(coord) {
  var closest_ind = 0;
  var closest_distance = 9999999;
  for (var i in latlngs) {
    var dist = coord.distanceTo(latlngs[i])
    if (dist < closest_distance) {
      closest_distance = dist;
      closest_ind = i;
    }
  }
  if (closest_distance < 200) {
    return closest_ind;
  }
  return -1;
}

function create_map() {
  map = L.map('mapid').setView(latlngs[0], 13);
  L.tileLayer('https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}', {
    attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
    maxZoom: 18,
    id: 'mapbox/streets-v11',
    tileSize: 512,
    zoomOffset: -1,
    accessToken: 'pk.eyJ1IjoieW94Y3UiLCJhIjoiY2s4c21scW8yMDB6MzNkbndlYXpraTEwdSJ9.VGfekLj7rTAtlifcuD4Buw'
  }).addTo(map);
  var polyline = L.polyline(latlngs, { color: 'red' }).addTo(map);
  // zoom the map to the polyline
  map.fitBounds(polyline.getBounds());

  map.on('mousemove', function (e) {
    var closest_ind = find_closest_ind(e.latlng);
    update_map_popup(closest_ind);
    adjust_plot_pos(closest_ind);
  });
}

function update_map_popup(indx) {
  if (indx != -1 && curr_map_indx != indx) {
    var content = []
    for (var i in series_shown) {
      if (series_shown[i]) {
        content = content.concat([
          names[i],
          ": ",
          data[parseInt(i) + 1][indx],
          units[i],
          "<br>"
        ]);
      }
    }
    content.pop()
    if (map_popup == null) {
      map_popup = L.popup()
        .setLatLng(latlngs[indx])
        .setContent(content.join(""))
        .openOn(map);
    } else {
      map_popup.setLatLng(latlngs[indx])
        .setContent(content.join(""))
        .update()
    }
    curr_map_indx = indx;
  }
}

function adjust_plot_pos(indx) {
  if (indx != -1 && curr_plot_indx != indx) {
    var time = Times[indx];
    var curr_plot_indx = indx;
    var view_width = uplot.scales.x.max - uplot.scales.x.min;
    var new_min = time - view_width / 2;
    var new_max = time + view_width / 2;
    if (new_min < Times[0]) {
      new_min = Times[0];
      new_max = new_min + view_width;
    } else if (new_max > Times[Times.length - 1]) {
      new_max = Times[Times.length - 1];
      new_min = new_max - view_width;
    }
    var new_cursor_left = (time - new_min) / (view_width) * uplot.bbox.width;
    uplot.setScale("x", { min: new_min, max: new_max });
    uplot.setCursor({ left: new_cursor_left, top: 0 })
  }
}

function generate_series() {
  var series = [{}];
  for (i in names) {
    var digit = 2;
    switch (names[i]) {
      case "DutyCycle":
      case "Altitude":
      case "Power":
        digit = 0;
    }
    series.push({
      // initial toggled state (optional)
      show: true,
      spanGaps: false,
      // in-legend display
      label: names[i],
      value: (function () {
        var j = i; // j is a copy of i only available to the scope of the inner function
        var digit_save = digit;
        return function (self, rawValue) {
          return rawValue.toFixed(digit_save) + units[j]
        }
      })(),
      scale: units[i],

      // series style
      stroke: colors[i],
      width: 1,
      fill: fill[i],
      dash: [10, 5],
    });
  }
  return series;
}

function generate_axes(show) {
  var axes = [{}]
  for (i in axes_names) {
    //1=right 3=left
    var side = (i % 2) * 2 + 1;
    axes.push(
      {
        show: show,
        scale: axes_names[i],
        values: (function () {
          var j = i; // j is a copy of i only available to the scope of the inner function
          return function (self, ticks) {
            return ticks.map(rawValue => rawValue + axes_names[j]);
          }
        })(),
        side: side,
        grid: { show: false },
      },
    )
  }
  return axes;
}

function generate_scales() {
  var scales = {};
  for (var i in axes_names) {
    var curr_min = 99999
    var curr_max = -99999
    var indxs = getAllIndexes(units, axes_names[i])
    for (var j in indxs) {
      curr_min = Math.min(curr_min, Math.min(...data[indxs[j] + 1]))
      curr_max = Math.max(curr_max, Math.max(...data[indxs[j] + 1]))
    }
    scales[axes_names[i]] = {
      auto: false,
      range: [curr_min, curr_max],
    }
  }
  return scales;
}

function get_window_size() {
  var height = document.getElementById("chart").offsetHeight;
  var legend = document.getElementsByClassName("legend");
  if (legend.length > 0) {
    height = height - legend[0].offsetHeight;
  } else {
    height = height * 0.8
  }
  return {
    width: document.getElementById("chart").offsetWidth,
    height: height,
  }
}

function create_chart() {
  var opts = {
    id: "plot",
    class: "chartclass",
    ...get_window_size(),
    plugins: [
      touchZoomPlugin()
    ],
    cursor: {
      y: false,
    },
    series: generate_series(),
    axes: generate_axes(false),
    scales: generate_scales(),
  };

  uplot = new uPlot(opts, data, document.getElementById("chart"));
  document.getElementById("chart").addEventListener("mousemove", e => {
    if (uplot.cursor.idx != null && curr_plot_indx != uplot.cursor.idx) {
      curr_plot_indx = uplot.cursor.idx;
      update_map_popup(curr_plot_indx);
    }
  });
  uplot.setSize(get_window_size());
}

function parse_LogFile(txt, time) {
  var lines = txt.split("\n");
  var values = lines[0].split(",");
  if (values.length > 10) {
    //old ackmaniac fw logs seperated by ,
    for (var i in lines) {
      if (lines[i] != "") {
        if (Times.length == 0) {
          if (i == 0) {
            var settings = lines[i].substr(2).split(",");
            for (var j in settings) {
              var li = document.createElement('li');
              document.getElementById('settings_list').appendChild(li);
              var setting = settings[j].split("=")
              li.innerHTML = ['<strong>', setting[0], '=</strong>', setting[1]].join("");
            }
          } else if (i == 1) {
            names = lines[i].split(",")
            //sort out time,faults,elapsedTime,lat,long
            names.splice(13, 4);
            names.splice(0, 1);
          }
        }
        if (i > 1) {
          var values = lines[i].split(",")

          //DD_MM_YY_HH_MM_SS.sss
          var ts = values[0].split("_")
          values = values.map((item) => {
            return Number(item);
          })
          values[0] = (new Date([ts[2], "-", ts[1], "-", ts[0], "T", ts[3], ":", ts[4], ":", ts[5], "Z"].join(""))).getTime() / 1000;
          if (values[15] != 0 && values[16] != 0) {
            Times.push(values[0]);
            TempPcbs.push(values[1]);
            MotorCurrents.push(values[2]);
            BatteryCurrents.push(values[3]);
            DutyCycles.push(values[4]);
            Speeds.push(values[5]);
            InpVoltages.push(values[6]);
            AmpHours.push(values[7]);
            AmpHoursCharged.push(values[8]);
            WattHours.push(values[9]);
            WattHoursCharged.push(values[10]);
            Distances.push(values[11]);
            Powers.push(values[12]);
            Faults.push(values[13]);
            TimePassedInMss.push(values[14]);
            latlngs.push([values[15], values[16]]);
            Altitudes.push(values[17]);
            GPSSpeeds.push(values[18]);
          } else {
            console.log("found invalid data:\n" + lines[i])
          }
        }
      }
    }
    return
  }
  values = lines[0].split(";");
  if (values.length > 10) {
    filetime = time.getTime()
    starttime = 0
    console.log(filetime, time)
    names = [
      "TempPcb",
      "MotorCurrent",
      "BatteryCurrent",
      "DutyCycle",
      "Speed",
      "InpVoltage",
      "AmpHours",
      "AmpHoursCharged",
      "WattHours",
      "WattHoursCharged",
      "Distance",
      "Power",
      "Altitude",
      "GPSSpeed"
    ]
    for (var i in lines) {
      values = lines[i].split(";");
      //ms_today;input_voltage;temp_mos_max;temp_mos_1;temp_mos_2;temp_mos_3;temp_motor;current_motor;
      //current_in;d_axis_current;q_axis_current;erpm;duty_cycle;amp_hours_used;amp_hours_charged;watt_hours_used;
      //watt_hours_charged;tachometer;tachometer_abs;encoder_position;fault_code;vesc_id;d_axis_voltage;q_axis_voltage;
      //ms_today_setup;amp_hours_setup;amp_hours_charged_setup;watt_hours_setup;watt_hours_charged_setup;battery_level;battery_wh_tot;current_in_setup;
      //current_motor_setup;speed_meters_per_sec;tacho_meters;tacho_abs_meters;num_vescs;ms_today_imu;roll;pitch;
      //yaw;accX;accY;accZ;gyroX;gyroY;gyroZ;gnss_posTime;
      //gnss_lat;gnss_lon;gnss_alt;gnss_gVel;gnss_vVel;gnss_hAcc;gnss_vAcc;

      if (lines[i] != "") {
        if (i > 0) {
          values = values.map((item) => {
            return Number(item);
          })
          if (starttime == 0) {
            starttime = values[0]
          }
          // console.log(values);

          if (values[48] != 0 && values[49] != 0) {
            Times.push((filetime + values[0] - starttime) / 1000);
            InpVoltages.push(values[1]);
            TempPcbs.push(values[2]);
            MotorCurrents.push(values[7]);
            BatteryCurrents.push(values[8]);
            DutyCycles.push(values[12] * 100);
            AmpHours.push(values[13]);
            AmpHoursCharged.push(values[14]);
            WattHours.push(values[15]);
            WattHoursCharged.push(values[16]);
            Speeds.push(values[33]);
            Distances.push(values[34] / 1000);
            Powers.push(0);
            Faults.push(values[20]);
            TimePassedInMss.push(0);
            latlngs.push([values[48], values[49]]);
            Altitudes.push(values[50]);
            GPSSpeeds.push(values[51]);
          } else {
            console.log("found invalid data:\n" + lines[i])
          }
        }
      }
    }
  }
}

function append_file_content(files_arr) {
  var done = true;
  for (var i in files_arr) {
    if (files_arr[i].reader.readyState != 2) {
      console.log("not fin");
      done = false;
      break;
    }
  }
  if (done) {
    files_arr.sort(compare_filetimes);
    for (i in files_arr) {
      parse_LogFile(files_arr[i].reader.result, files_arr[i].time)
    }
    data = [Times, TempPcbs, MotorCurrents, BatteryCurrents, DutyCycles, Speeds, InpVoltages, AmpHours, AmpHoursCharged, WattHours, WattHoursCharged, Distances, Powers, Altitudes, GPSSpeeds]
    create_map();
    create_chart();
    fill_menu();
    show_content();
  }
}

var files;
function handleFileSelect(evt) {
  show_loader();
  files = evt.target.files; // FileList object
  var files_arr = []
  // files is a FileList of File objects. List some properties.
  var output = [];
  for (var i = 0, f; f = files[i]; i++) {
    output.push('<li><strong>', escape(f.name), '</strong> (', f.type || 'n/a', ') - ',
      f.size, ' bytes', '</li>');
    // Only process image files.
    if (!f.type.match('text.*')) {
      handleError("Error Selecting File: Not a text/csv File")
      continue;
    }


    var name_parts = f.name.split(".")[0].split("_");
    var time = (new Date([name_parts[0], "T", name_parts[1].replace(/-/g, ":")].join("")));

    var reader = new FileReader();
    // Closure to capture the file information.
    reader.onload = function (e) {
      append_file_content(files_arr); //todo append
      //parse_LogFile(e.target.result);
    };

    // Read in the image file as a data URL.
    reader.readAsText(f);
    files_arr.push({ time: time, reader: reader });
  }
  //document.getElementById('file_list').innerHTML = '<ul>' + output.join('') +'</ul>';
}

if (window.location.search.length > 1) {
  var args = window.location.search.substr(1).split("&");
  for (i in args) {
    var arg = args[i].split("=");
    switch (arg[0]) {
      case "log":
        get_Log(arg[1]);
        break;
      default:
        show_upload();
    }
  }
} else {
  show_upload();
}
document.getElementById('files').addEventListener('change', handleFileSelect, false);
window.addEventListener("resize", throttle(() => uplot.setSize(get_window_size()), 100));
