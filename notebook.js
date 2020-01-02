

// ------------------------------------------- TO CHANGE

function round_button(icon,type='fab',more_class='') {
    let btn = $('<button>').addClass(more_class)
    .addClass('mdl-button mdl-js-button')
    .addClass('mdl-button--'+type+' mdl-js-ripple-effect')
    let icon_div =$('<i>').addClass('material-icons').html(icon)
    btn.append(icon_div)
    return btn
}

function text_button(text,type='raised',more_class='') {
    let btn = $('<button>').addClass(more_class)
    .addClass('mdl-button mdl-js-button')
    .addClass('mdl-button--'+type+' mdl-js-ripple-effect')
    .css('margin',10).html(text)
    return btn
}

// ------------------------------------------ VAR

let gsi = new GoogleSignIn('1070660703362-5m1lo7rov7tn5ubo8oti29i7aqvu89ju.apps.googleusercontent.com')
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
    let score_map = {}
    for(let word of words) {
        for(let word_map in map) {
            if(word_map.includes(word)) {
                for(let id in map[word_map]) {
                    let word_id_score = map[word_map][id]
                    if(!score_map.hasOwnProperty(id)) {
                        score_map[id] = 0
                    }
                    score_map[id] += word_id_score
                }
            }
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

// ------------------------------------------ MIRROR

async function get_user_connector() {
    let profile = await gsi.get_profile_data()
    let connect_name = 'user'+profile.id
    await mirror.create_base(connect_name,{notes:{},current_search_string:''})
    return await mirror.connect(connect_name)
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
    let del = $('<button>').html('delete').addClass('delete')
    title.append(date).append(del)
    let text = $('<div>').addClass('text')
    let input = $('<textarea>').addClass('input')
    note_jQ.append(title).append(input).append(text)

    // --- FCT

    input.val(note_connector.get([],'text'))
    text.html((input.val()))

    // --- CLICK

    del.click(function() {
        note_connector.delete()
    })

    text.click(function() {
        input.focus()
    })

    input.keyup(function(e) {
        let txt = input.val()
        note_connector.set([],'text',txt)
    })

    input.bind('input propertychange', function() {
        text.html((input.val()))
    })
    
    input.keydown(function(e) {
        setTimeout(function() {
            let cur_pos_end = input[0].selectionEnd
            console.log(cur_pos_end)
        })
    });

    // --- EVT

    note_connector.on_prop('set',[],'date',function(new_date) {
        let print_date = timestamp_to_date(new_date)
        date.html(print_date)
    })

    note_connector.on_prop('set',[],'text',function(new_text) {
        let map = create_word_map(note_connector.get_base())
        user_connector.set(['notes'],note_id,map)
    })

    note_connector.on_event('del_base',function(new_text) {
        note_jQ.remove()
        user_connector.del(['notes'],note_id)
    })

    // --- RET

    return note_jQ

}

async function display_idea() {
    return new Promise(async function(end) {

        let user_connector = await get_user_connector()

        // --- JQ

        $('.container').html('')

        let bar = $('<div>').addClass('menu')

        let add = $('<button>').html('ADD')
        let input = $('<input>')

        let notes_space = $('<div>')

        bar.append(add).append(input)

        $('.container').append(bar).append(notes_space)

        // --- FCT

        async function handle_string(search_string) {
            console.log(search_string)
            if(search_string.length < 2) {
                return
            }
            let global_map = await create_global_map(user_connector.get([],'notes'))
            console.log(global_map)
            let ids = await notes_engine(search_string, global_map)
            let connectors = await get_multi_note_connector(ids)
            let space = $('<div>')
            for(let id of ids) {
                let jq = await get_disp_note_id(id)
                space.append(jq)
            }
            notes_space.html(space)
        }

        async function include_note_id(note_id) {
            let connector = await get_note_connector(note_id)
            user_connector.set(['notes'],note_id,create_word_map(connector.get_base()))
        }

        async function add_new_note() {
            let new_note = create_note()
            await mirror.create_base(new_note.id,new_note)
            return new_note
        }

        // --- CLICK

        add.click(async function() {
            let new_note = await add_new_note()
            await include_note_id(new_note.id)
            let date = timestamp_to_date(new_note.date)
            console.log('set')
            user_connector.set([],'current_search_string',date)
        })

        input.keyup(function() {
            let notes_string = input.val().toLowerCase()
            user_connector.set([],'current_search_string',notes_string)
        })

        // --- EVT

        user_connector.on_prop('set',[],'current_search_string',function(search_string) {
            console.log('read')
            input.val(search_string)
            handle_string(search_string)
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