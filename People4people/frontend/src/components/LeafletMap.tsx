import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface LeafletMapProps {
  latitude: number;
  longitude: number;
  reports?: any[];
  onLocationChange?: (lat: number, lon: number) => void;
  isInteractive?: boolean;
}

export const LeafletMap: React.FC<LeafletMapProps> = ({ 
  latitude, 
  longitude, 
  reports = [],
  onLocationChange,
  isInteractive = true
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const currentMarker = useRef<L.Marker | null>(null);
  const [selectedLat, setSelectedLat] = useState(latitude);
  const [selectedLon, setSelectedLon] = useState(longitude);

  useEffect(() => {
    if (!mapContainer.current) return;
    if (map.current) return; // Only initialize once

    // Initialize map
    map.current = L.map(mapContainer.current).setView([latitude, longitude], 13);

    // Add OpenStreetMap tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map.current);

    // Add current location marker
    currentMarker.current = L.marker([latitude, longitude], {
      icon: L.icon({
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41],
      }),
    })
      .addTo(map.current)
      .bindPopup(`Current Location: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);

    // Add markers for reports
    reports.forEach((report) => {
      if (map.current && report.latitude && report.longitude) {
        L.marker([report.latitude, report.longitude], {
          icon: L.icon({
            iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41],
          }),
        })
          .addTo(map.current)
          .bindPopup(`${report.category || 'Report'}: ${report.description}`);
      }
    });

    // Add click handler for interactive map
    if (isInteractive && map.current) {
      map.current.on('click', (e: L.LeafletMouseEvent) => {
        const { lat, lng } = e.latlng;
        
        // Update selected location state
        setSelectedLat(lat);
        setSelectedLon(lng);

        // Remove old marker and add new one
        if (currentMarker.current) {
          currentMarker.current.remove();
        }

        currentMarker.current = L.marker([lat, lng], {
          icon: L.icon({
            iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41],
          }),
        })
          .addTo(map.current!)
          .bindPopup(`Selected Location: ${lat.toFixed(4)}, ${lng.toFixed(4)}`)
          .openPopup();

        // Notify parent component of location change
        if (onLocationChange) {
          onLocationChange(lat, lng);
        }
      });
    }
  }, [latitude, longitude, reports, isInteractive, onLocationChange]);

  return (
    <div>
      <div
        ref={mapContainer}
        style={{
          width: '100%',
          height: '400px',
          borderRadius: '8px',
          border: '1px solid #ccc',
        }}
      />
      {isInteractive && (
        <p style={{ fontSize: '12px', color: '#666', marginTop: '8px', textAlign: 'center' }}>
          💡 Click anywhere on the map to set the incident location
          <br />
          Current: {selectedLat.toFixed(4)}, {selectedLon.toFixed(4)}
        </p>
      )}
    </div>
  );
};
