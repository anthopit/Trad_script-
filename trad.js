const fs = require('fs')
const cmd = process.argv[2]
const pathDirToImport = process.argv[3]
const pathDir = ['pages','shared']
const exportPathFile = "export"


const TypeDirEnum = Object.freeze({
  fileDir:1,
  subDir:2,
  unknow:3
})


const writeFileToExport = (data, pathFileToExport) => {
  const jsonStringFr = JSON.stringify(data, null, 4)
  const exportFileName = pathFileToExport.replace(/\//g, '_')
  fs.writeFile(`${exportPathFile}/${exportFileName}_fr.json`, jsonStringFr, err => {
    console.log(err);
  })
  console.log(`Copied ${exportFileName} to export directory`);
}

const insertJson = (json, trad, pathArray) => {
  for (i=0; i < pathArray.length;  i++) {
    if (json[pathArray[i]] !== undefined) {
      if (json[pathArray[i]] instanceof Object) {
        insertJson(json[pathArray[i]], trad, pathArray.slice(1))
      } else {
        json[pathArray[i]] = trad
      }
    }
  }
}


const copyFileToExport = (pathFileToExport) => {
  const exportFileName = pathFileToExport.replace(/\//g, '_')
  fs.copyFile(`${pathFileToExport}/fr.json`, `${exportPathFile}/${exportFileName}_fr.json`, err => {
    if (err) { console.log(err); }
    else { console.log(`Copied ${exportFileName} to export directory`); }
  });
}

const getKeysJson = (json, root, finalArr) => {
  const arr = []
  for (let k in json) {
    let root2 = root + '.' + k
    if (json[k] instanceof Object) {
      getKeysJson(json[k], root2, finalArr)
    } else {
      arr.push(root2)
    }
  }
  finalArr.push(arr)
}

const getValue = (json, pathArray) => {
  let res = json

  for(i=0; i < pathArray.length;  i++){
    res = res[pathArray[i]]
    if (res === undefined) {
      break
    }
  }
  return res
}

const rmEmptyObj = (json) => {
  for (let k in json) {
    if (json[k] instanceof Object) {
      if (Object.keys(json[k]).length === 0){
        delete json[k]
      } else {
        rmEmptyObj(json[k])
      }
    }
  }
}

const testEmptyObj = (json) => {
  for (let k in json) {
    if (json[k] instanceof Object) {
      if (Object.keys(json[k]).length === 0){
        return true
      } else {
        rmEmptyObj(json[k])
      }
    }
  }
}

const comparFileChange = (jsonFr, jsonEn) => {
  const finalArr = []

  getKeysJson(jsonFr, "", finalArr)
  const finalArrFlat = finalArr.flat()

  finalArrFlat.forEach(p => {

    let res = jsonEn

    for(i=1; i < p.split(".").length;  i++){
      res = res[p.split(".")[i]]
      if (res === undefined) {
        break
      }
    }

    if ( res !== "" && res !== undefined) {
      pathTab = p.split('.').slice(1)
      deleteJsonValue(jsonFr, pathTab)
    }
  })
  let x = true

  while (x) {
    rmEmptyObj(jsonFr)
    if (!testEmptyObj(jsonFr)){
      x = false
    }
  }
  rmEmptyObj(jsonFr)
}

const deleteJsonValue = (jsonObj, pathTab) => {
  for(i=0; i < pathTab.length;  i++) {
    if (jsonObj[pathTab[i]] instanceof Object) {
      deleteJsonValue(jsonObj[pathTab[i]], pathTab.slice(1))
    }else {
      delete jsonObj[pathTab[i]]
    }
  }
}

const getFiles = async (path) => {

  let dataFr = await fs.promises.readFile(`${path}/fr.json`, 'utf-8')
  let dataEn = await fs.promises.readFile(`${path}/en.json`, 'utf-8')

  jsonObjFr = JSON.parse(dataFr);
  jsonObjEn = JSON.parse(dataEn);

  comparFileChange(jsonObjFr, jsonObjEn)
  if (Object.keys(jsonObjFr).length !== 0) {
    writeFileToExport(jsonObjFr, path)
  }
}


const processFileDirectory = (dirents, path) => {
  switch (dirents.length) {
    // The folder only has a fr.json file
    case 1:
      if(dirents[0].name === "fr.json") {
        copyFileToExport(path)
      } else {
        console.log(`The ${path} folder is invalid.`);
      }
      break;
    // The folder has a fr.json file and an en.json file
    case 2:
      if(dirents[0].name === "en.json" && dirents[1].name === "fr.json") {
        getFiles(path)
      } else {
        console.log(`The ${path} folder is invalid.`);
      }
      break;
    default:
      console.log(`The ${path} folder is invalid.`);
      break;
  }
}

// Analyse the content of a directory and return :
// TypeDirEnum.fileDir : if its contents are files
// if content is directories : TypeDirEnum.subDir
// if content is files and directories : TypeDirEnum.unknow
const analyseDirectories = (dirents) => {
  var typeDir
  for (let dirent of dirents) {
    if (dirent.isFile() && (typeDir === TypeDirEnum.fileDir || typeDir === undefined)) {
      typeDir = TypeDirEnum.fileDir
    }
    else if (dirent.isDirectory() && (typeDir === TypeDirEnum.subDir || typeDir === undefined)) {
      typeDir = TypeDirEnum.subDir
    }
    else {
      typeDir = TypeDirEnum.unknow
      break
    }
  }
  return typeDir
}

// this recursive function
const processDirectory = (pathFile, dirName) => {
  const currentDirPath = `${pathFile}/${dirName}`
  fs.promises.readdir(currentDirPath, {withFileTypes : true})
    .then(dirents => {
      const typeDir = analyseDirectories(dirents)
      switch (typeDir) {
        // Case fileDir
        case 1:
          processFileDirectory(dirents, currentDirPath)
          break;
        // Case subDir we process again the directory to acces to the .json files
        case 2:
          for (let dirent of dirents) {
            processDirectory(pathFile,`${dirName}/${dirent.name}`)
          }
          break;
        case 3:
          console.log(`The format of the ${dirName} file is invalid: a folder can only have one type of entity`);
          break;
        default:
          break;
      }
    })
    .catch(err => {
      console.log(err);
    })
}



const getDirectories = () => {
  pathDir.forEach(pathFile => {
    fs.promises.readdir(pathFile, {withFileTypes : true})

      // If promise resolved and
      // datas are fetched
      .then(files => {
        for (let file of files) {
          if (file.isDirectory()) {
            processDirectory(pathFile, file.name)
          } else {
            processFileDirectory(files, pathFile)
          }
        }
      })
      // If promise is rejected
      .catch(err => {
        console.log(err)
      })
  })
}

const addTrad = (jsonTrad, jsonEn, jsonFr, pathInApp) => {

  const finalJson = jsonFr

  const arrKeysEn = []
  const arrKeysTrad = []
  const arrKeysFr = []
  const comparKeys = []

  getKeysJson(jsonTrad, "", arrKeysTrad)
  getKeysJson(jsonEn, "", arrKeysEn)
  getKeysJson(jsonFr, "", arrKeysFr)

  const arrKeysTradFlat = arrKeysTrad.flat()
  const arrKeysEnFlat = arrKeysEn.flat()
  const arrKeysFrFlat = arrKeysFr.flat()

  arrKeysEnFlat.forEach(p => {
    pathArray = p.split(".")
    pathArray.splice(0,1)


    const value = getValue(jsonEn, pathArray)
    if (value !== "") {
      comparKeys.push(p)
      insertJson(finalJson, value, pathArray)
    }
  })

  comparKeys.push(arrKeysTradFlat)

  arrKeysTradFlat.forEach(p => {
    pathArray = p.split(".")
    pathArray.splice(0,1)

    const value = getValue(jsonTrad, pathArray)
    insertJson(finalJson, value, pathArray)
  })

  const comparKeysFlat = comparKeys.flat()

  let intersection = arrKeysFrFlat.filter(x => !comparKeysFlat.includes(x));

  intersection.forEach(p => {
    pathArray = p.split(".")
    pathArray.splice(0,1)

    insertJson(finalJson, "", pathArray)
  })

  const jsonString = JSON.stringify(finalJson, null, 4)
  fs.writeFile(pathInApp, jsonString, err => {
    console.log(err);
  })
  console.log(`JSON file has been copied in ${pathInApp}`);
}



var exportDir = () => {
  if (!fs.existsSync(exportPathFile)){
    fs.mkdir('export', { recursive: true }, (err) => {
      if(err) {
        console.log(`Error : ${err}`);
      }else {
        getDirectories()
      }
    });
  }else {
    console.log(`Please clean the existing export file`);
  }
}


var importDir = (pathDirToImport) => {
  fs.promises.readdir(pathDirToImport)
    .then(dirents => {
      for(let dirent of dirents){
        let jsonTrad = JSON.parse(fs.readFileSync(`${process.argv[3]}/${dirent}`));
        let jsonEn
        if(fs.existsSync(dirent.replace(/\_/g, '/').replace("fr.json", "en.json"))) {
          jsonEn = JSON.parse(fs.readFileSync(dirent.replace(/\_/g, '/').replace("fr.json", "en.json")));
        }
        let jsonFr = JSON.parse(fs.readFileSync(dirent.replace(/\_/g, '/')));
        const pathToPast = dirent.replace(/\_/g, '/').replace("fr.json", "en.json")
        addTrad(jsonTrad, jsonEn, jsonFr, pathToPast)
      }
    })
    .catch(err => {
      console.log(err);
    })
}

switch(cmd){
  case "export": exportDir(); break;
  case "import": importDir(pathDirToImport); break;
  default: console.log(`\n Unknow command used: ${cmd} \n`); break;
}
