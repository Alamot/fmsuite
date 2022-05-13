var datatables = {};
for (i = 0; i < TABLES.length; i++) {
    datatables[TABLES[i]] = $('#' + TABLES[i]).DataTable({
      {% if first_column_hidden %}
        columnDefs: [{ "targets": [ 0 ], "visible": false }],
      {% endif %}
      responsive: { details: false },
      autoWidth: false,
      order: [],
      paging: false,
      select: true,
      dom: 'Blrti',
      buttons: ['copy', 'csv', 'excel', 'pdf', 'print'],
    });  
    $('#' + TABLES[i] + ' thead tr').clone().appendTo('#' + TABLES[i] + ' thead');
    $('#' + TABLES[i] + ' thead tr:eq(1) th').removeClass();
    $('#' + TABLES[i] + ' thead tr:eq(1) th').each(function (x) {
        $(this).html( '<input class="filter w-100" type="text" placeholder="Filter" />' );
        $('input', this).on('keyup change', function () {
            if (datatables[this.closest('table').id].column(x).search() !== this.value ) {
                datatables[this.closest('table').id].column(x).search(this.value).draw();
            }
        });
    });
}

$('.filter').on('click', function( event ){  event.stopPropagation(); });
