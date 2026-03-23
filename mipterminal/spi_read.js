// Note: This sript is intended to be run in the MIP Terminal environment.
// It demonstrates SPI communication with the MLX90835 sensor using SCPI commands.

    // Commands for the MLX90835.
WRITE = 0x80;
READ = 0x81;
READ_STATUS_BYTE = 0x0F;
START_SINGLE_MEASUREMENT_MODE = 0x1E;
START_WOC_MODE = 0x2D;
START_BURST_MODE = 0x3C;
START_CONTINUOUS_MODE = 0x4B;
START_IDLE_MODE = 0x5A;
START_MEASUREMENT = 0x69;
MEMORY_FETCH = 0x78;
MEMORY_WRITE = 0x87;
ADDRESSED_RESET = 0x96;
GLOBAL_RESET = 0xA5;
READ_MEASUREMENT = 0xB4;
CLEAR_ERROR_FLAGS = 0xC3;
CLEAR_RESET_FLAG = 0xD2;

function hexByte(value) {
    var v = Number(value) & 0xFF;
    var hex = v.toString(16).toUpperCase();

    while (hex.length < 2) {
        hex = '0' + hex;
    }

    return '0x' + hex;
}

function spi_cmd(cmd, len) {
    var response;

    if (typeof len === 'undefined') {
        len = 1;
    }

    response = String(scpi(':SPI:CS0 0; :SPI:EXCH ' + len + ',' + hexByte(cmd) + '; :SPI:CS0 1')[1]);
    response = response.replace(/\r?\n\(OK\)>$/, '');
    response = response.replace(/\(OK\)>$/, '');

    return response;
}

function parseHexBytes(response) {
    var matches = String(response).match(/0x[0-9A-Fa-f]+|[0-9A-Fa-f]{2}/g);
    var bytes = [];
    var index;
    var value;

    if (!matches) {
        return bytes;
    }

    for (index = 0; index < matches.length; index++) {
        value = parseInt(matches[index], 16);
        if (!isNaN(value)) {
            bytes.push(value & 0xFF);
        }
    }

    return bytes;
}

function measure(n, config) {
    var data_rx;
    var pressure;
    var tint_offset;
    var tntc;
    var tint;
    var ntc_mode;
    var tint_mode;

    if (typeof config === 'undefined' || config === null) {
        config = 0x02AB;
    }

    data_rx = parseHexBytes(spi_cmd(READ_MEASUREMENT, n + 2));

    if (data_rx.length < 3) {
        return null;
    }

    pressure = ((data_rx[1] << 8) | data_rx[2]) & 0xFFFF;
    tint_offset = 0;
    ntc_mode = (config & 0x01C0) >> 6;

    if (ntc_mode > 1 && data_rx.length >= 5) {
        tntc = ((data_rx[3] << 8) | data_rx[4]) & 0xFFFF;
        tint_offset = 2;
    } else if (ntc_mode > 0 && data_rx.length >= 4) {
        tntc = data_rx[3] & 0xFF;
        tint_offset = 1;
    } else {
        tntc = -1;
    }

    tint_mode = (config & 0x0038) >> 3;

    if (tint_mode > 1 && data_rx.length > (4 + tint_offset)) {
        tint = ((data_rx[3 + tint_offset] << 8) | data_rx[4 + tint_offset]) & 0xFFFF;
    } else if (tint_mode > 0 && data_rx.length > (3 + tint_offset)) {
        tint = data_rx[3 + tint_offset] & 0xFF;
    } else {
        tint = -1;
    }

    return [pressure, tntc, tint];
}

function formatMeasurement(values) {
    if (!values) {
        return 'Measurement parse error';
    }

    return 'P=' + values[0] + ' Tntc=' + values[1] + ' Tint=' + values[2];
}

function decodeStatusByte(statusByte) {
    // Port of the provided Python decode_response() logic.
    var response = (Number(statusByte) & 0xFF) >>> 0;
    var msg = (response & 0x80) ? 'RST\t' : '...\t';
    var mode = (response & 0x70) >> 4;
    switch (mode) {
        case 0: msg += 'mode=start-up '; break;
        case 1: msg += 'mode=Cont. '; break;
        case 2: msg += 'mode=Sgl Meas '; break;
        case 3: msg += 'mode=Brst '; break;
        case 4: msg += 'mode=WOC '; break;
        case 5: msg += 'mode=Idle '; break;
        case 6: msg += 'mode=UNKOWN '; break;
        case 7: msg += 'mode=FAILSAFE '; break;
        default: break;
    }
    if (response & 0x08) msg += 'COMM_ERROR ';
    if (response & 0x04) msg += 'EXEC_ERROR ';
    if (response & 0x02) msg += 'DATA_RDY ';
    if (response & 0x01) msg += 'PARITY ';
    return msg;
}

// Initialize I2C
scpi(':VDD:OFF');
scpi(':SPI:CS0 1');
scpi(':I2C:DEINIT');
scpi(':SPI:INIT 2');
scpi(':SPI:BUF 1,1,1,1,0');
scpi(':VDD:3V3');

print(decodeStatusByte(spi_cmd(READ_STATUS_BYTE)));
print(decodeStatusByte(spi_cmd(CLEAR_RESET_FLAG)));
print(decodeStatusByte(spi_cmd(CLEAR_ERROR_FLAGS)));
print(decodeStatusByte(spi_cmd(READ_STATUS_BYTE)));

// Start Continuos Mode
print("Start Continuos Mode: " + spi_cmd(START_CONTINUOUS_MODE));
print(decodeStatusByte(spi_cmd(READ_STATUS_BYTE)));

// Measurements
for (var i = 0; i < 10; i++) {
    print(formatMeasurement(measure(8)));
}

//print(spi_cmd(READ_STATUS_BYTE));
print(decodeStatusByte(spi_cmd(READ_STATUS_BYTE)));

print("--- Done ---")
