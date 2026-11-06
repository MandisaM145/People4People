FROM osrm/osrm-backend:v5.25.0

WORKDIR /data

COPY south-africa-260812.osm.pbf .

RUN osrm-extract south-africa-260812.osm.pbf -p /usr/local/etc/osrm/profiles/car.lua && \
    osrm-contract south-africa-260812.osrm
