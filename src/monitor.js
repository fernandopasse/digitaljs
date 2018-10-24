"use strict";

import joint from 'jointjs';
import _ from 'lodash';
import Backbone from 'backbone';
import { Vector3vl } from '3vl';
import { Waveform, drawWaveform, defaultSettings, extendSettings } from 'wavecanvas';
import { ResizeSensor } from 'css-element-queries';

function getWireId(wire) {
    const hier = [wire.cid];
    for (let sc = wire.graph.get('subcircuit'); sc != null; sc = sc.graph.get('subcircuit')) {
        hier.push(sc.cid);
    }
    hier.reverse();
    return hier.join('.');
}

export class Monitor {
    constructor(circuit) {
        this._circuit = circuit;
        this._wires = new Map();
        this.listenTo(this._circuit, 'new:paper', (paper) => this.attachTo(paper));
    }
    attachTo(paper) {
        this.listenTo(paper, 'link:monitor', (linkView) => {
            this.addWire(linkView.model);
        });
    }
    addWire(wire) {
        const wireid = getWireId(wire);
        if (this._wires.has(wireid)) return;
        this.listenTo(wire, 'change:signal', this._handleChange);
        const waveform = new Waveform(wire.get('bits'));
        waveform.push(this._circuit.tick, wire.get('signal'));
        this._wires.set(wireid, {wire: wire, waveform: waveform});
        this.trigger('add', wire);
    }
    removeWire(wire) {
        this.trigger('remove', wire);
        this.stopListening(wire);
        this._wires.delete(getWireId(wire));
    }
    _handleChange(wire, signal) {
        this._wires.get(getWireId(wire)).waveform.push(this._circuit.tick, signal);
    }
}

_.extend(Monitor.prototype, Backbone.Events);

export class MonitorView extends Backbone.View {
    initialize() {
        this._width = 800;
        this._settings = extendSettings(defaultSettings, {start: 0, pixelsPerTick: 5, gridStep: 1});
        this.listenTo(this.model, 'add', this._handleAdd);
        this.listenTo(this.model._circuit, 'postUpdateGates', (tick) => { this._settings.start = tick - this._width / this._settings.pixelsPerTick; this._settings.present = tick; this._drawAll(); });
        this.render();
    }
    render() {
        this.$el.html('<table class="monitor"></table>');
        for (const wobj of this.model._wires.values()) {
            this.$('table').append(this._createRow(wire));
        }
        this._drawAll();
        this._canvasResize();
        new ResizeSensor(this.$el, () => {
            this._canvasResize();
        });
        return this;
    }
    _canvasResize() {
        this._width = Math.max(this.$el.width() - 300, 100);
        this.$('canvas').attr('width', this._width);
    }
    _drawAll() {
        for (const wireid of this.model._wires.keys()) {
            this._draw(wireid);
        }
    }
    _draw(wireid) {
        const canvas = this.$('tr[wireid='+wireid+']').find('canvas');
        const waveform = this.model._wires.get(wireid).waveform;
        drawWaveform(waveform, canvas[0].getContext('2d'), this._settings);
    }
    _handleAdd(wire) {
        this.$('table').append(this._createRow(wire));
    }
    _handleRemove(wire) {
        this.$('tr[wireid='+getWireId(wire)+']').remove();
    }
    _createRow(wire) {
        const wireid = getWireId(wire);
        const row = $('<tr><td class="name"></td><td><canvas class="wavecanvas" width="'+this._width+'" height="25"></canvas></td></tr>');
        row.attr('wireid', wireid);
        row.children('td').first().text(wireid);
        return row;
    }
}