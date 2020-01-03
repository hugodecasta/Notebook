

// ------------------------------------------- TO CHANGE

function round_button(icon,type='fab',more_class='') {
    let btn = $('<button>').addClass('mdl-button mdl-js-button mdl-button--'+type+' '+more_class)
    .append($('<i>').addClass('material-icons').html(icon))
    return btn
}

function text_button(text,type='raised',more_class='') {
    let btn = $('<button>').addClass(more_class)
    .addClass('mdl-button mdl-js-button')
    .addClass('mdl-button--'+type+' mdl-js-ripple-effect')
    .css('margin',10).html(text)
    return btn
}

function set_long_click(jq,cb) {
    var pressTimer;
    function start() {
        pressTimer = window.setTimeout(cb,1000)
        return false
    }
    function end() {
        clearTimeout(pressTimer)
        return false
    }
    jq.taphold(cb)
    jq.mousedown(start).mouseup(end)
}

// ------------------------------------------ VAR

let gsi = new GoogleSignIn('222256535269-68ujsdblb6n23q8je8d2knlpsbjfl88g.apps.googleusercontent.com')
let bm = new BoolMaster('BoolMaster/api.php')
let mirror = new Mirror(bm)

// ------------------------------------------ SEARCH ENGINE

function split_text(text) {
    let words = text.toLowerCase().replace(/\n/g, ' ').split(' ')
    let ret = []
    for(let word of words) {
        if(word == '') {
            continue
        }
        ret.push(word.replace('.','').replace(',',''))
    }
    return ret
}

function create_word_map(note) {
    let text = note.text
    let date = timestamp_to_date(note.date)
    text = date+' '+text
    let words = split_text(text)
    let map = {}
    for(let word of words) {
        if(!map.hasOwnProperty(word)) {
            map[word] = 0
        }
        map[word] += 1
    }
    return map
}

function create_global_map(note_maps) {
    let global_map = {}
    for(let id in note_maps) {
        for(let word in note_maps[id]) {
            let occurance = note_maps[id][word]
            if(!global_map.hasOwnProperty(word)) {
                global_map[word] = {}
            }
            global_map[word][id] = occurance
        }
    }
    return global_map
}

async function notes_engine(search_string, map) {
    let words = split_text(search_string)
    let score_map = null

    for(let word of words) {
        let word_score_map = {}
        for(let word_map in map) {
            if(word_map.includes(word)) {
                for(let id in map[word_map]) {
                    let word_id_score = map[word_map][id]
                    if(!word_score_map.hasOwnProperty(id)) {
                        word_score_map[id] = 0
                    }
                    word_score_map[id] += word_id_score
                }
            }
        }
        if(score_map == null) {
            score_map = word_score_map
            continue
        }
        let to_del = []
        for(let id in score_map) {
            if(word_score_map.hasOwnProperty(id)) {
                score_map[id] += word_score_map[id]
            } else {
                to_del.push(id)
            }
        }
        for(let id of to_del) {
            delete score_map[id]
        }
    }

    let score_array = []
    for(let id in score_map) {
        let score = score_map[id]
        score_array.push({id,score})
    }
    score_array.sort((a, b) => (a.score < b.score) ? 1 : -1)
    let ids = score_array.map(elm => elm.id)
    return ids
}

// ------------------------------------------ DATA

function add_zero(val) {
    return val<10?'0'+val:val
}

function timestamp_to_date(timestamp) {
    let date = new Date(timestamp)
    let day = add_zero(date.getDate())
    let month = add_zero(date.getMonth()+1)
    let year = add_zero(date.getFullYear())
    let hour = add_zero(date.getHours())
    let minute = add_zero(date.getMinutes())
    let str = day+'/'+month+'/'+year+' '+hour+':'+minute
    return str
}

function create_note() {
    let date = Date.now()
    let id = 'noteid@'+parseInt(Math.random()*10000)+''+date
    let text = ''
    let map = {}
    let note = {id,date,text,map}
    return note
}

async function create_sharing_notes(note_ids, search_string, pre_name='') {
    let sharing_connector = await get_sharing_connector()
    let new_name = prompt('enter the sharing token',pre_name)
    let obj = {ids:{},search_string:search_string}
    for(let id of note_ids) {
        obj.ids[id] = true
    }
    sharing_connector.set([],new_name,obj)
    return new_name
}

// ------------------------------------------ MIRROR

var local_user_conn = null
async function get_user_connector() {
    if(local_user_conn != null) {
        return local_user_conn
    }
    let profile = await gsi.get_profile_data()
    let connect_name = 'user'+profile.id
    await mirror.create_base(connect_name,{notes:{},current_search_string:''})
    local_user_conn = await mirror.connect(connect_name)
    return local_user_conn
}

async function get_sharing_connector() {
    return await mirror.connect('sharing_connector')
}

async function get_note_connector(note_id) {
    return await mirror.connect(note_id)
}

async function get_multi_note_connector(note_ids) {
    return new Promise((ok)=>{
        let promises = []
        for(let id of note_ids) {
            let prom = get_note_connector(id)
            promises.push(prom)
        }
        let map = {}
        Promise.all(promises).then(function(values) {
            for(let conn of values) {
                let id = conn.get([],'id')
                map[id] = conn
            }
            ok(map)
        })
    })

}

// ------------------------------------------ DISP

async function get_disp_note_id(note_id) {

    let note_connector = await get_note_connector(note_id)
    let user_connector = await get_user_connector()

    note_connector.reset_waiters()

    // --- JQ

    let note_jQ = $('<div>').addClass('note')

    let title = $('<div>').addClass('title')
    let date = $('<div>').addClass('date')
    title.append(date)

    let bottom_spacer = $('<div>').addClass('bottom')
    
    let text = $('<div>').addClass('text')
    let input = $('<textarea>').addClass('input')
    note_jQ.append(title).append(input).append(text).append(bottom_spacer)

    let is_shared = user_connector.get(['notes',note_id],'is_shared')

    let code = null
    let link = null
    let del = null
    let delink = null

    if(!is_shared) {
        code = round_button('code','icon','code')
        link = round_button('link','icon','link')
        del = round_button('cancel','icon','delete')
        title.append(code).append(link).append(del)
    } else {
        delink = round_button('link_off','icon','delink')
        title.append(delink)
    }

    // --- FCT

    function disp_marked() {
        let mark = marked(input.val())

        let replacers = {
            '//check':'{check_box}',
            '//uncheck':'{check_box_outline_blank}',
            '<a':'<a target="_blank"',
            '{(\\w+)}':'<i class="material-icons">$1</i>'
        }
        for(let hnum of [5,4,3,2,1]) {
            replacers['<h'+hnum] = '<h'+(hnum+2)
            replacers['h'+hnum+'>'] = 'h'+(hnum+2)+'>'
        }

        for(let from in replacers) {
            let to = replacers[from]
            mark = mark.replace(new RegExp(from,'g'), to)
        }
        text.html(mark)
    }

    input.val(note_connector.get_direct('text'))
    disp_marked()

    // --- CLICK
    
    if(!is_shared) {

        code.click(function() {
            if(note_jQ.hasClass('code_mode')) {
                note_jQ.removeClass('code_mode')
            } else {
                note_jQ.addClass('code_mode')
            }
        })

        link.click(async function() {
            let date = timestamp_to_date(note_connector.get_direct('date'))
            let sharing_token = await create_sharing_notes([note_id],date,note_id)
            if(sharing_token != null) {
                alert('your friend might longtap the "create" button to enter the token')
            }
        })
    
        del.click(function() {
            if(confirm('delete this note ?')) {
                note_connector.delete()
            }
        })

    } else {

        delink.click(function() {
            user_connector.del(['notes'],note_id)
        })

    }

    input.keyup(function(e) {
        let txt = input.val()
        note_connector.set_direct('text',txt)
    })

    input.bind('input propertychange', function() {
        disp_marked()
    })

    var clicking = false
    note_jQ.mousedown(function() {
        if(clicking === false) {
            clicking = true
        }
    })

    note_jQ.mouseup(function() {
        if(clicking) {
            input.focus()
        }
        clicking = false
    })

    text.mousedown(function() {
        if(note_jQ.hasClass('edit')) {
            clicking = null
        }
    })

    input.focusin(function() {
        note_jQ.addClass('edit')
    })

    input.focusout(function(e) {
        if(clicking) {
            return
        }
        note_jQ.removeClass('edit')
        note_jQ.removeClass('code_mode')
    })

    // --- EVT

    note_connector.on_prop('set',[],'date',function(new_date) {
        let print_date = timestamp_to_date(new_date)
        date.html(print_date)
    })

    note_connector.on_prop('set',[],'text',function() {
        let map = create_word_map(note_connector.get_base())
        user_connector.set(['notes',note_id],'map',map)
    })

    user_connector.on_prop('del',['notes'],note_id,function() {
        let height = note_jQ.outerHeight()
        let container = $('<div>').addClass('note_disappear_container')
        container.css('height',height+'px')
        .append(note_jQ.clone())
        note_jQ.replaceWith(container)
        
        setTimeout(function() {
            container.remove()
        },500)
    })

    note_connector.on_event('del_base',function(new_text) {
        user_connector.del(['notes'],note_id)
    })

    // --- RET

    return note_jQ

}

async function display_idea() {
    return new Promise(async function(end) {

        let user_connector = await get_user_connector()

        let notes = user_connector.get_direct('notes')
        for(let id in notes) {
            let data = notes[id]
            if(data.hasOwnProperty('map')) {
                continue
            }
            notes[id] = {map:data,is_shared:false}
        }

        // --- JQ

        $('.container').html('')

        let bar = $('<div>').addClass('menu')

        let add_contain = $('<div>').addClass('add_contain')
        let add = round_button('create','fab','add')
        let input = $('<input>').addClass('search')

        let global_link = round_button('link','icon','global_link')

        let inter_bar = $('<div>').addClass('inter_bar')

        add_contain.append(add)

        let notes_space = $('<div>').addClass('note_space')

        bar.append(inter_bar).append(add_contain).append(input)

        $('.container').append(bar).append(notes_space).append(global_link)

        // --- FCT

        async function handle_string(search_string) {
            if(search_string == '') {
                return
            }
            if(search_string == '-') {
                notes_space.html('')
                return
            }
            if(search_string == '*') {
                await display_notes(Object.keys(user_connector.get_direct('notes')))
                return
            }
            if(search_string.length < 2) {
                return
            }
            let notes = user_connector.get_direct('notes')
            let note_map = {}
            for(let id in notes) {
                note_map[id] = notes[id].map
            }
            let global_map = await create_global_map(note_map)
            let ids = await notes_engine(search_string, global_map)
            await display_notes(ids)
        }

        var pre_ids = []
        async function display_notes(ids) {
            if(JSON.stringify(ids) == JSON.stringify(pre_ids)) {
                return
            }
            pre_ids = ids
            await get_multi_note_connector(ids)
            let space = $('<div>').addClass('space')
            for(let id of ids) {
                let jq = (await get_disp_note_id(id))
                .addClass('appear')
                setTimeout(function() {
                    jq.removeClass('appear')
                },400)
                space.append(jq)
            }
            notes_space.html(space)
            setTimeout(function() {
                if(ids.length == 1) {
                    $('.input').focus()
                }
            })
        }

        async function include_note_id(note_id,is_shared=false) {
            let connector = await get_note_connector(note_id)
            let obj = {
                is_shared:is_shared,
                map:create_word_map(connector.get_base())
            }
            user_connector.set(['notes'],note_id,obj)
        }

        async function add_new_note() {
            let new_note = create_note()
            await mirror.create_base(new_note.id,new_note)
            return new_note
        }

        // --- CLICK

        async function add_click() {
            let new_note = await add_new_note()
            await include_note_id(new_note.id)
            let date = timestamp_to_date(new_note.date)
            user_connector.set_direct('current_search_string',date)
        }

        add.click(add_click)

        set_long_click(add,async function() {
            let sharing_connector = await get_sharing_connector()
            let sharing_token = prompt('shared token')
            if(sharing_token == null) {
                return
            }
            let shared = sharing_connector.get([],sharing_token,null)
            if(shared == null) {
                alert('token incorrect')
                return
            }
            sharing_connector.del_direct(sharing_token)
            for(let id in shared.ids) {
                await include_note_id(id,true)
            }
            user_connector.set_direct('current_search_string',shared.search_string)
        })

        input.keyup(function() {
            let notes_string = input.val()
            user_connector.set_direct('current_search_string',notes_string)
        })

        global_link.click(async function() {
            let search_string = input.val()
            let sharing_token = await create_sharing_notes(pre_ids,search_string,search_string)
            if(sharing_token != null) {
                alert('your friend might longtap the "create" button to enter the token')
            }
        })

        // --- EVT

        let handle_to = null
        user_connector.on_prop('set',[],'current_search_string',function(search_string) {
            input.val(search_string)
            clearTimeout(handle_to)
            handle_to = setTimeout(function() {
                handle_string(search_string)
            },500)
        })

        user_connector.on_path('add',['notes'],function() {
            handle_string(input.val())
        })

    })
}

// ------------------------------------------ CORE

async function satisfy_user() {
    while(true) {
        await display_idea()
    }
}

async function main() {
    await satisfy_user()
}

$(document).ready(main)