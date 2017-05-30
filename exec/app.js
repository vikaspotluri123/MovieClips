window.movieClips = window.movieClips || {};
window.movieClips.vids = [];
window.movieClips.isLoading = true;
window.movieClips.shorty = true;
window.movieClips.index = 0;
window.movieClips.range = {};
window.movieClips.range.lower = 180;
window.movieClips.range.upper = 360;
window.movieClips.util = window.movieClips.util || {}
window.movieClips.util.allFiles = function(folder)
{
	var results = [];

	fs.readDir(folder).forEach(function(file)
	{
		file = `${folder}/${file}`;
		var stat = fs.stat(file);
		if (stat && stat.isDirectory())
			results = results.concat(window.movieClips.util.allFiles(file))
		else
			results.push(file);
	});

	return results;
}
window.movieClips.defaultDirectory = "D:/Media/";
window.movieClips.updateList = function(next)
{
	data.get('dirs',function(e,dirs)
	{
		if(e)
		{
			Materialize.toast('Failed to get folders to browser',1000)
		}
		else
		{
			if(dirs == {})
			{
				data.set('dirs',[window.movieClips.defaultDirectory]);
				window.movieClips.updateList(next);
			}
			else
			{
				dirs.forEach(function(dir)
				{
					window.movieClips.setStatus(`Reading Directory ${dir}`);
					files = window.movieClips.util.allFiles(dir);
					window.movieClips.vids = window.movieClips.vids.concat(files);
				});
				window.movieClips.setStatus('Removing Duplicates');
				window.movieClips.vids = unique(window.movieClips.vids);
				window.movieClips.setStatus('Randomizing');
				window.movieClips.vids = shuffle(window.movieClips.vids);
				next();
			}
		}
	});
}

window.movieClips.setLoading = function(to)
{
	window.movieClips.isLoading = to
	if(to)
	{
		//$("#loading-wrapper").fadeIn();
		$("body").addClass('loading');
	}
	else
	{
		//$("#loading-wrapper").fadeOut();
		$("body").removeClass('loading');
	}
}

window.movieClips.setStatus = function(status)
{
	$("#status").text(status);
}

window.movieClips.setMovie = function(index)
{
	movie = window.movieClips.vids[index];
	ext = movie.split('.');
	ext = ext[ext.length-1];
	exts = ['mp4'];
	if($.inArray(ext,exts) < 0)
	{
		console.log(movie,'rejected');
		window.movieClips.nextHandle();
	}
	else
	{
		console.log(movie);
		$("#main").attr('src',movie);
		$("#main").on('loadedmetadata', function()
		{
			len = $(this).prop('duration');
			start = Math.floor(Math.random()*(len-0.5+1)+0.5);
			if((len - start) < window.movieClips.range.upper)
				start = len - window.movieClips.range.upper;
			this.currentTime = start;
		});
		$("#main")[0].load();
		if(window.movieClips.shorty)
			window.movieClips.timeout = window.movieClips.addTimeOut();
		else $('#main').on('ended',window.movieClips.nextHandle)
	}
}

window.movieClips.nextHandle = function()
{
	clearTimeout(window.movieClips.timeout);
	window.movieClips.index++;
	if(window.movieClips.index == window.movieClips.vids.length - 1)
	{
		window.movieClips.index = 0;
		window.movieClips.vids = [];
		window.movieClips.setLoading(true);
		window.movieClips.updateList(buttonClicks);
	}
	else
	{
		window.movieClips.setMovie(window.movieClips.index);
	}
}

window.movieClips.addTimeOut = function()
{
	timeout = Math.floor(Math.random()*(window.movieClips.range.upper-window.movieClips.range.lower+1)+window.movieClips.range.lower);
	console.log('Timeout of',timeout,'Seconds');
	return setTimeout(window.movieClips.nextHandle,timeout*1000);
}

window.movieClips.setLoading(true);
window.movieClips.updateList(buttonClicks);
function buttonClicks()
{
	window.movieClips.setStatus('Making buttons clickable');
	$("#back").click(function()
	{
		window.movieClips.index--;
		window.movieClips.setMovie(window.movieClips.index);
	});
	$("#next").click(window.movieClips.nextHandle);

	$("#playPause").click(function()
	{
		current = $(this).html();
		if(current == 'play')
		{
			clearTimeout(window.movieClips.timeout)
			window.movieClips.shorty = true;
		}
		else
		{
			window.movieClips.shorty = false;
			window.movieClips.timeout = addTimeOut();
		}
	});

	window.movieClips.setStatus('Starting Up');
	window.movieClips.setMovie(0);
	window.movieClips.setStatus('Leaving');
	window.movieClips.setLoading(false);
}