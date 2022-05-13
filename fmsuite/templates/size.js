function humanFileSize(bytes, si) {
    var thresh = si ? 1000 : 1024;
    if (Math.abs(bytes) < thresh) { return bytes + ' B'; }
    var units = si ? ['kB','MB','GB','TB','PB','EB','ZB','YB'] : ['KiB','MiB','GiB','TiB','PiB','EiB','ZiB','YiB'];
    var u = -1;
    do {
      bytes /= thresh;
      ++u;
    } while(Math.abs(bytes) >= thresh && u < units.length - 1);
    return bytes.toFixed(1)+' '+units[u];
}

for (i = 0; i < SIZE_INPUTS.length; i++) {
  $('#' + SIZE_INPUTS[i]).on("input", function () {
    if (this.value) {
      $('#' + this.id + '-humansize').text('(' + humanFileSize(this.value) + ')');
    } else {
      $('#' + this.id + '-humansize').text('');
    }
  }); 
}


