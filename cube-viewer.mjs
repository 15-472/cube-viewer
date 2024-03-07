

function rgbe_to_rgb(r,g,b,e) {
	if (r === 0 && g === 0 && b === 0 && e=== 0) {
		return [0,0,0];
	} else {
		return [
			(r + 0.5) / 256 * (2**(e-128)),
			(g + 0.5) / 256 * (2**(e-128)),
			(b + 0.5) / 256 * (2**(e-128))
		];
	}
}

//opto-electronic transfer function for sRGB -- maps linear light -> sRGB value
// based on https://www.shadertoy.com/view/4tXcWr
// and https://entropymine.com/imageworsener/srgbformula/
function linear_to_srgb(x) {
	if (x <= 0.0031308) {
		return x * 12.92;
	} else {
		return 1.055 * (x ** (1/2.4)) - 0.055;
	}
}

//basic linear tone mapping function:
function tonemap(x) {
	return Math.max(0, Math.min(1, x));
}


export class CubeViewer {
	constructor(div, width, height, rgbe) {
		//rgb is uint8 * 4 array
		console.assert(width * 6 == height, "Expecting +x, -y, +y, -y, +z, -z faces stacked vertically.");
		console.assert(width * height * 4 == rgbe.length, "rgbe data is width * height * 4.");

		const size = this.size = width;

		this.div = div;
		this.div.innerHTML = "";
		const faces = [
			{name:"Positive X", s:"-z", t:"-y", rgbe:rgbe.subarray(0*size*size*4, 1*size*size*4)},
			{name:"Negative X", s:"+z", t:"-y", rgbe:rgbe.subarray(1*size*size*4, 2*size*size*4)},
			{name:"Positive Y", s:"+x", t:"+z", rgbe:rgbe.subarray(2*size*size*4, 3*size*size*4)},
			{name:"Negative Y", s:"+x", t:"-z", rgbe:rgbe.subarray(3*size*size*4, 4*size*size*4)},
			{name:"Positive Z", s:"+x", t:"-y", rgbe:rgbe.subarray(4*size*size*4, 5*size*size*4)},
			{name:"Negative Z", s:"-x", t:"-y", rgbe:rgbe.subarray(5*size*size*4, 6*size*size*4)},
		];

		function axisClass(label) {
			let ret = "";
			if (label[0] === "+") ret = "pos";
			else if (label[0] === "-") ret = "neg";
			ret += label[1].toUpperCase();
			return ret;
		}
		function flip(label) {
			if (label[0] === "+") return "-" + label.substr(1);
			else if (label[0] === "-") return "+" + label.substr(1);
		}

		window.FACES = faces; //DEBUG
		for (const face of faces) {
			const figure = document.createElement('figure');
			figure.classList.add("face");
			const caption = document.createElement('figcaption');
			caption.innerText = face.name;

			{
				const d = document.createElement('div');
				d.classList.add('minS');
				d.innerText = flip(face.s);
				d.classList.add(axisClass(flip(face.s)));
				figure.appendChild(d);
			}
			{
				const d = document.createElement('div');
				d.classList.add('maxS');
				d.innerText = face.s;
				d.classList.add(axisClass(face.s));
				figure.appendChild(d);
			}
			{
				const d = document.createElement('div');
				d.classList.add('minT');
				d.innerText = flip(face.t);
				d.classList.add(axisClass(flip(face.t)));
				figure.appendChild(d);
			}
			{
				const d = document.createElement('div');
				d.classList.add('maxT');
				d.innerText = face.t;
				d.classList.add(axisClass(face.t));
				figure.appendChild(d);
			}


			const canvas = document.createElement('canvas');
			figure.appendChild(canvas);
			figure.appendChild(caption);
			this.div.appendChild(figure);

			canvas.width = size;
			canvas.height = size;
			canvas.style.width = `${canvas.width / window.devicePixelRatio}px`;
			canvas.style.height = `${canvas.height / window.devicePixelRatio}px`;

			const ctx = canvas.getContext('2d', {colorSpace:"srgb"});
			const image = ctx.createImageData(size, size, {colorSpace:"srgb"});
			/*
			//sRGB mapping test image:
			for (let y = 0; y < size; ++y) {
				for (let x = 0; x < size; ++x) {
					let i = (y*size + x)*4;
					let c;
					if (Math.floor(y / 32) % 4 == 0) {
						if (Math.random() < x / (size-1)) c = 255;
						else c = 0;
					} else if (Math.floor(y / 32) % 4 == 1) {
						c = 255 * linear_to_srgb(x / (size-1));
					} else if (Math.floor(y / 32) % 4 == 2) {
						c = (x % 2 ? 255 : 0);
					} else {
						c = 255 * linear_to_srgb(0.5);
					}
					image.data[i+0] = c;
					image.data[i+1] = c;
					image.data[i+2] = c;
					image.data[i+3] = 255;
				}
			}*/

			for (let px = 0; px < size*size; ++px) {
				const [r,g,b] = rgbe_to_rgb( face.rgbe[px*4+0], face.rgbe[px*4+1], face.rgbe[px*4+2], face.rgbe[px*4+3] );

				image.data[4*px+0] = 255*linear_to_srgb(tonemap(r));
				image.data[4*px+1] = 255*linear_to_srgb(tonemap(g));
				image.data[4*px+2] = 255*linear_to_srgb(tonemap(b));
				image.data[4*px+3] = 0xff;
			}
			ctx.putImageData(image, 0,0);
		}
	}
	static async fromFile(div, file) {
		div.classList.add('cube');
		div.innerHTML = "Loading...";
		const bitmap = await createImageBitmap(file, {colorSpaceConversion:"none"});
		div.innerHTML = "Loading... (have image)";
		const width = bitmap.width;
		const height = bitmap.height;
		//get image contents by drawing to offscreen canvas and reading back uint8array:
		//  (seems cumbersome!)
		const canvas = new OffscreenCanvas(width, height);
		const ctx = canvas.getContext('2d');
		ctx.drawImage(bitmap, 0,0);
		const rgbe = ctx.getImageData(0,0, width, height).data;

		//actually make the viewer control thing:
		return new CubeViewer(div, width, height, rgbe);
	}

}

export default { CubeViewer };
