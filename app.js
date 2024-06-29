const { createBot, createProvider, createFlow, addKeyword, EVENTS } = require('@bot-whatsapp/bot');
const QRPortalWeb = require('@bot-whatsapp/portal');
const JsonFileAdapter = require('@bot-whatsapp/database/json');
const BaileysProvider = require('@bot-whatsapp/provider/baileys');
const axios = require('axios');

let daysCache = [];
let selectedDay = '';
let availableTurns = [];
let selectedTurn = null;
let userName = '';
let datosTurnoDD = {};

async function loadAllDays() {
    try {
        const apiURL = `http://localhost:4000/api/v1/turns`;
        const response = await axios.get(apiURL);
        console.log('API Response:', response.data);
        return response.data;
    } catch (error) {
        console.error('Error al cargar los días:', error);
        return [];
    }
}

async function getTurnsForDay(day) {
    try {
        const apiURL = `http://localhost:4000/api/v1/turns/${day}`;
        const response = await axios.get(apiURL);
        console.log('Turnos para el día', day, ':', response.data);
        return response.data;
    } catch (error) {
        console.error('Error al cargar los turnos para el día', day, ':', error);
        return [];
    }
}

async function updateTurnAvailability(turnId, isAvailable, clientName) {
    datosTurnoDD = {
        idTurno: turnId,
        cliente: clientName,
        dia: selectedDay
    };
    console.log('Datos del turno guardados en datosTurnoDD:', datosTurnoDD);
}

async function initializeDaysCache() {
    daysCache = await loadAllDays();
    console.log('Días cargados:', daysCache);
}

const flowPrincipal = addKeyword(['hola', 'alo', 'saludos'])
    .addAnswer('👋 ¡Hola! Bienvenido a la peluquería de Sandra', {
        media: '../assets/sandraPB.jpeg',
    })
    .addAnswer(
        '¿En qué puedo ayudarte hoy?\n\n Responde con: A, B ...\n\n' +
        'A - Consultar un corte\n' +
        'B - Pedir un turno\n' +
        'C - Dar de baja mi turno\n'
    );

const flowConsulta = addKeyword(['1', 'consulta', 'consultar', 'corte', 'pelo'])
    .addAnswer('Si lo que deseas es cortarte el pelo, tenemos dos opciones de corte según tu presupuesto:')
    .addAnswer(
        '💇 $4000 / Corte de peluquera\n' +
        '💇‍♂️ $2000 / Corte de aprendiz'
    )
    .addAnswer('Si deseas cortarte, por favor escribe el comando "Hola" y selecciona "Pedir un turno".');

const flowTurno = addKeyword('B')
    .addAnswer('Un momento por favor, estoy consultando los días de la semana disponibles...')
    .addAction(async (ctx, { flowDynamic }) => {
        const daysMessage = `Los días disponibles son:\n - ${daysCache.join('\n - ')}`;
        console.log(daysMessage);
        await flowDynamic(daysMessage);
    })
    .addAnswer('¿Qué día desea agendar?', { capture: true }, async (ctx, { flowDynamic }) => {
        const userResponse = ctx.body.toLowerCase().trim();
        console.log('User response:', userResponse);

        if (daysCache.map(day => day.toLowerCase()).includes(userResponse)) {
            selectedDay = userResponse;
            availableTurns = await getTurnsForDay(userResponse);
            const filteredTurns = availableTurns.filter(turn => turn.disponible);
            if (filteredTurns.length > 0) {
                const turnsMessage = `Los turnos disponibles para ${userResponse} son:\n\n - ${filteredTurns.map(turn => `${turn.id} : ${turn.inicio} - ${turn.fin}`).join('\n - ')}`;
                await flowDynamic(turnsMessage);
                await flowDynamic('Responde con el numero del turno que deseas agendar, por ejemplo, "1".');
            } else {
                await flowDynamic(`No hay turnos disponibles para ${userResponse}.`);
            }
        } else {
            await flowDynamic('El día ingresado no está disponible. Por favor, elija uno de los días disponibles.');
            const daysMessage = `Los días disponibles son:\n - ${daysCache.join('\n - ')}`;
            await flowDynamic(daysMessage);
        }
    })
    .addAnswer('Ingresa el ID del turno que deseas agendar:', { capture: true }, async (ctx, { flowDynamic }) => {
        const selectedId = parseInt(ctx.body.trim(), 10);
        selectedTurn = availableTurns.find(turn => turn.id === selectedId);

        if (selectedTurn) {
            if (selectedTurn.disponible) {
                await flowDynamic(`El turno con numero ${selectedId} (${selectedTurn.inicio} - ${selectedTurn.fin}) está disponible.`);
            } else {
                await flowDynamic(`Lo siento, el turno con numero ${selectedId} no está disponible. Por favor, elija otro turno.`);
            }
        } else {
            await flowDynamic(`El turno ingresado no es válido. Por favor, elija un numero válido de los turnos disponibles.`);
        }
    })
    .addAnswer('Por favor, proporciona tu nombre completo para confirmar la reserva:', { capture: true }, async (ctx, { flowDynamic }) => {
        userName = ctx.body.trim();

        if (selectedTurn && selectedTurn.disponible) {
            try {
                await updateTurnAvailability(selectedTurn.id, false, userName);
                await flowDynamic(`Gracias ${userName}, tu turno para el ${selectedDay} a las ${selectedTurn.inicio} ha sido reservado.`);
            } catch (error) {
                console.error('Error al actualizar el turno:', error);
                await flowDynamic(`Ocurrió un error al reservar tu turno. Por favor, intenta nuevamente.`);
            }
        } else {
            await flowDynamic(`Ocurrió un error al reservar tu turno. Por favor, intenta nuevamente.`);
        }
    });

const flowWelcome = addKeyword(EVENTS.WELCOME)
    .addAnswer("👋 ¡Bienvenido a la peluquería de SANDRA! Si quieres realizar una consulta, envía el comando 'Hola'", {
        delay: 1000,
    });

const createTurn = (data) => {
    
}

const main = async () => {
    await initializeDaysCache();

    const adapterDB = new JsonFileAdapter();
    const adapterFlow = createFlow([flowPrincipal, flowWelcome, flowConsulta, flowTurno]);
    const adapterProvider = createProvider(BaileysProvider);

    createBot({
        flow: adapterFlow,
        provider: adapterProvider,
        database: adapterDB,
    });
    
    QRPortalWeb();
    
  //  setInterval(() => {
    //    console.log('Datos del turno y cliente:', datosTurnoDD);
   // }, 5000); 
    
    createTurn(datosTurnoDD);
};

main().catch(error => console.error('Error starting the bot:', error));