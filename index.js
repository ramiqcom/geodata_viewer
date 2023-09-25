// Map data
const Map = L.map('map').setView([0, 117], 5);

// Tile 
L.tileLayer('http://mt0.google.com/vt/lyrs=m&hl=en&x={x}&y={y}&z={z}', {
	attribution: 'Google Maps'
}).addTo(Map);

// Vector tile 
let vectorTile;

// Image tile
let imageTile;

// Map div
const MapDiv = document.getElementById('map');

// On drag function
MapDiv.ondragover = function prepare(e){
	e.preventDefault();
}

// On drop function
MapDiv.ondrop = async function loadData(e){
	e.preventDefault();

	// Get file
	const file = e.dataTransfer.files[0];

	// Get file format
	let format = file.name.split('.');
	format = format[format.length - 1];
		
	// Bounds
	let bounds;

	// Data type
	let type;
	switch (format){
		case 'geojson':
		case 'json':
		case 'zip':
		case 'kml':
		case 'kmz':
			type = 'vector';
			break;
		case 'tiff':
		case 'tif':
			type = 'raster';
			break;
	}

	// Run something based on type
	switch (type) {
		case 'vector':
			// GeoJSON file
			let geojson;

			// Parse geojson
			switch (format) {
				case 'geojson':
				case 'json':
					geojson = JSON.parse(await file.text());
					break;
				case 'kmz':
				case 'kml':
					geojson = new DOMParser().parseFromString(await file.text(), 'text/xml');
					geojson = await toGeoJSON.kml(geojson);
					break;
				case 'zip':
					geojson = await shp(await file.arrayBuffer());
					break;
			}

			// Set bounds
			bounds = L.geoJSON(geojson).getBounds();

			// Option for geojson tile
			const optionsVector = {
				maxZoom: 12,
				tolerance: 5,
				debug: 0,
				style: { 
					color: 'blue', weight: 1, fillOpacity: 0.3 
				}
			};

			// Vector tle
			vectorTile = L.geoJson.vt(geojson, optionsVector).addTo(Map);
			break;
		case 'raster':
			imageTile = await parseGeoraster(file);
			imageTile = new GeoRasterLayer({
				georaster: imageTile,
				opacity: 1,
				resolution: 1024
			}).addTo(Map);
	
			bounds = imageTile.extent.leafletBounds;
			break;
	}

	// Zoom to feature
	Map.fitBounds(bounds);
}